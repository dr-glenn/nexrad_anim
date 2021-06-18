// JavaScript to display NOAA/NWS weather radar product on a map

import 'elm-pep';
import 'ol/ol.css';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import WMSCapabilities from 'ol/format/WMSCapabilities';
import {transform} from 'ol/proj';	// use curly-brace to import a function
import {transformExtent} from 'ol/proj';
import {fromLonLat} from 'ol/proj'
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
//import Style from 'ol/style/Style';
import Icon from 'ol/style/Icon';
import { Style, Circle as CircleStyle, Fill } from 'ol/style';
import Zoom from 'ol/control/Zoom';

/*
import $ from 'jquery';
window.jQuery = window.$ = $;
*/

//Configuration information
var radarSite    = 'kmux';	// Radar station designation
var radarProduct = 'bref_raw';	// Radar product
var radarProd    = radarSite+'_'+radarProduct; // can be changed with buttons
var radarZoom    = 7;		// Radar initial zoom
var radarWidth   = '400px';	// Radar map width
var radarHeight  = '300px';	// Radar map height
var wmsImageStyle = 'radar_reflectivity';	// should fetch this from capabilities
var autoPlay	 = true;	// true: startup with animation
const mapCRS	 = 'EPSG:4326';		// Map coordinate reference system - Note: map center calculation below 
var animationMaxHours	= 1;			// Maximum hours for animation data
// TODO: next 2 should not be used
var latitudeCenter		= 0;			// Map latitude center, zero means use radar site center
var longitudeCenter		= 0;			// Map longitude center, zero means use radar site center
var wmsLayerSource = null;
var wmsLayer = null;
var iconLayer = null;
var displayMap = null;  // OL Map object displayed in a DIV
const useLegendApi		= false;		// Use legend API to get legend URL or, if false, use legend URL in GetCapabilities

var lastGetCapTime = null;
var defaultTime = null;     // from WMSCapabilities, the most recent radar time
var allTimes = null;	// Array of datetime from WMSCapabilities, converted to Date objects
var startDateIdx = 0;
var startTime = null;   // a Date-Time value from WMSCapabilities
var frameRate = 1.0; // frames per second
var animationIntervalId = null; // when not null, animation is running
var refreshTimerId = null;   // ID for setTimeout to refresh getCapabilities
var bbox4326 = null;    // bounding box in 4326 coordinates
var displayLayers = null;   // Array of layers in the Map display
var timeZone = "America/Los_Angeles";
var startGetCapabilities = 0;   // time the lengthy getCapabilities call
var endGetCapabilities = 0;     // finish the lengthy getCapabilities call
var refreshMinutes = 5;         // how often to perform GetCapabilities
var retryShortTime = 15000;     // retry getCapabilities after failure. time in millisec
var CountTimer = 0;     // time since most recent image in seconds

console.log('start '+radarProduct);

function time_error(msg) {
    var now = new Date();
    console.error(now.toISOString()+': '+msg);
}

function time_warn(msg) {
    var now = new Date();
    console.warn(now.toISOString()+': '+msg);
}

/*
// jQuery code not used now
$(document).ready(function() {
    $('#play').click(play);
    $('#pause').click(stop);
    $('#latest').click(stopLatest);
    $('button[name="radar_product"]').addClass('btn-default');
    $('button[name="radar_product"]').click(function() {
        //console.log('button:'+$(this).val());
        // clear btn-clicked from all buttons in the group
        $('button[name="radar_product"]').removeClass('btn-clicked').addClass('btn-default');
        $(this).removeClass('btn-default').addClass('btn-clicked');
        radarProduct = $(this).val();
        radarProd = radarSite+'_'+radarProduct;
        getCapabilities();
    });
    $('button[name="location"]').click(function() {
        //console.log('button:'+$(this).val());
        // clear btn-clicked from all buttons in the group
        $('button[name="location"]').removeClass('btn-clicked').addClass('btn-default');
        $(this).removeClass('btn-default').addClass('btn-clicked');
        changeLocation($(this).val());
    });
});
*/

window.onload = function() {
    // individual buttons that control animation
	document.getElementById('play').addEventListener('click', play, false);
	document.getElementById('pause').addEventListener('click', stop, false);
    document.getElementById('latest').addEventListener('click', stopLatest, false);
    // button groups that act like radio buttons
    document.getElementsByName("radar_product").forEach((button) => {button.classList.add('btn-default');});
    document.getElementsByName("radar_product").forEach((button) => {button.addEventListener("click", radarClick, false);});
    
    document.getElementById('next_panel').addEventListener('click', nextPanel, false);
    document.getElementById('daily_fcst').addEventListener('click', dailyFcst, false);
    createLocationButtons();
    
    kickOffDisplay();
}

function createLocationButtons() {
    // using Array "locations", construct buttons inside DIV "loc_buttons"
    var locDiv = document.getElementById('loc_buttons');
    for (var i=0; i < locations.length; i++) {
        var but = document.createElement('button');
        but.name = 'location';
        but.value = i.toString();
        but.innerHTML = locations[i].getHomeName();
        but.classList.add('btn-default');
        but.addEventListener("click", locationClick, false);
        locDiv.appendChild(but);
    }
}

function changeRadar(rtype) {
    radarProduct = rtype;
    // store the radar_type into form so that we can pass to other pages
    document.getElementById('radar_type').value = radarProduct;
    // get all the radar_type buttons
    var radButtons = document.getElementsByName("radar_product");
    // we don't know the previous select, so remove class btn-clicked from all, e.g., unselect all buttons
    radButtons.forEach((button) => {button.classList.remove('btn-clicked'); button.classList.add('btn-default');});
    // now remove class btn-default from new selected button and add btn-clicked
    radButtons.forEach((button) => { if (button.value === rtype) {
        button.classList.remove('btn-default');
        button.classList.add('btn-clicked');
    }});
    radarProd = radarSite+'_'+radarProduct;
    getCapabilities();
}

function radarClick() {
    // we don't know the previous select, so remove class btn-clicked from all, e.g., unselect all buttons
    //document.getElementsByName("radar_product").forEach((button) => {button.classList.remove('btn-clicked'); button.classList.add('btn-default');});
    // now remove class btn-default from new selected button and add btn-clicked
    //this.classList.remove('btn-default');
    //this.classList.add('btn-clicked');
    changeRadar(this.value);
}

function locationClick() {
    // we don't know the previous select, so remove class btn-clicked from all, e.g., unselect all buttons
    //document.getElementsByName("location").forEach((button) => {button.classList.remove('btn-clicked'); button.classList.add('btn-default');});
    // now remove class btn-default from new selected button and add btn-clicked
    //this.classList.remove('btn-default');
    //this.classList.add('btn-clicked');
    changeLocation(this.value);
}

var sidePanels = ['ctrl_buttons','hourly_fcsts'];   // IDs of DIV within the sidebar
var sidePanelsButtonTxt = ['Radar Control','Forecasts'];    // text for button that switches panels
var sidePanelIdx = 0;
// handle button click, display next panel
function nextPanel() {
    var oldPanel = document.getElementById(sidePanels[sidePanelIdx]);
    oldPanel.style.display = "none";
    sidePanelIdx += 1;
    if (sidePanelIdx >= sidePanels.length) sidePanelIdx = 0;
    var nextIdx = sidePanelIdx + 1;
    if (nextIdx >= sidePanels.length) nextIdx = 0;
    var nextButtonTxt = sidePanelsButtonTxt[nextIdx];
    document.querySelector('#next_panel').innerHTML = nextButtonTxt;
    
    // replace current panel with next from sidePanels
    var sidebar = document.getElementById("sidebar");
    var newId = sidePanels[sidePanelIdx];
    var newPanel = document.getElementById(newId);
    //console.log('newPanel='+newId);
    if (newId == 'hourly_fcsts') {
        var lon_lat = currentLocation.getLonLat();
        var tz_hour = currentLocation.tz_off;
        var req_args = {'lon_lat': lon_lat.toString(), 'hours': [1,2,3,6,9], 'tz': tz_hour};
        //console.log('req_args = '+req_args.toString());
        console.log('thing: '+new URLSearchParams(req_args));
        fetch('http://localhost:5000/hourly_divs?'+new URLSearchParams(req_args)).
            then( response => response.text() ).
            then( data => {newPanel.innerHTML = data;} );
    }
    newPanel.style.display = "block";
}

// Handle daily_fcst button
function dailyFcst() {
    
}

// Create map marker icon (Reference: ol.style.Icon)
// a big house on the map
const bigHouseSource = 'https://openlayers.org/en/latest/examples/data/icon.png';
var bigHouseIcon = new Icon({
	anchor: [0.5, 46],
	anchorXUnits: 'fraction',
	anchorYUnits: 'pixels',
	src: bigHouseSource
});

// a red dot on the map
const redDotSource = 'https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg';
var redDotIcon = new Icon({
	anchor: [0.5, 0.5],
	anchorXUnits: 'fraction',
	anchorYUnits: 'fraction',
	src: redDotSource
});

// home long-lat coordinates and nearest radar
class HomeLocation {
    constructor(name, lon_lat, radar_sta, time_zone, tz_off) {
        this.name = name;   // use name to display a button in the UI
        this.lon_lat = lon_lat; // display a marker at the home
        this.radar_sta = radar_sta;
        this.loc3857 = transform(this.lon_lat, 'EPSG:4326', 'EPSG:3857');
        this.time_zone = time_zone; // at the home location
        this.tz_off = tz_off;
    }
    getHomeName() { return this.name; }
    getLonLat() { return this.lon_lat; }
    getTzOff() { return this.tz_off; }
    
    getMarkerLayer() {
        var iconFeature = new Feature({
            geometry: new Point([this.loc3857[0],this.loc3857[1]]),
            name: 'HOME',
        });
        let mapMarkerStyle = new Style({      // Create map marker style
            image: new CircleStyle({radius: 5, fill: new Fill({color: "red" }) })
        });
        let mapMarkerFeatureSource = new VectorSource({
            features: [iconFeature]
        });
        let mapMarkerLayer = new VectorLayer({    // Create map marker vector layer
            source:  mapMarkerFeatureSource,
            style:   mapMarkerStyle,
            zIndex: 11
        });
        return mapMarkerLayer;
    }
    
    getRadarStation() { return this.radar_sta; }
}

// Location buttons are created from this Array and ordered on screen from 0 to N
var locations = new Array();
var homeDover = new HomeLocation('Dover', [-121.97259,36.99283], 'kmux', "America/Los_Angeles", -8);
var homeLolita = new HomeLocation('Sue', [-75.85384,42.16405], 'kbgm', "America/New_York", -5);
var homeBobSeattle = new HomeLocation('Bob', [-122.03546,47.55889], 'katx', "America/Los_Angeles", -8);
var portlandLoc = new HomeLocation('Portland', [-122.68334,45.51689], 'krtx', "America/Los_Angeles", -8);
locations.push(homeDover);
locations.push(homeLolita);
locations.push(homeBobSeattle);
locations.push(portlandLoc);
var currentLocation = null; // will be set when changeLocation is called

// get value of a GET request parameter
// see https://stackoverflow.com/questions/831030/how-to-get-get-request-parameters-in-javascript
// USE: val=get_req('foo'); if (val === undefined) <no value>;
function get_req(name) {
   if(name=(new RegExp('[?&]'+encodeURIComponent(name)+'=([^&]*)')).exec(location.search))
      return decodeURIComponent(name[1]);
}

function storeLoc(loc) {
    // store into form
    var lon_lat = loc.getLonLat();
    document.getElementById('lon_lat').value = lon_lat.toString();
    document.getElementById('tz_off').value = loc.getTzOff();
    document.getElementById('radar_sta').value = loc.getRadarStation();
    document.getElementById('home_name').value = loc.getHomeName();
    // radar_type is stored when radarClick is called
    //document.getElementById('radar_type').value = radarProduct;
}
function changeLocation(idx) {
    // idx value 0 is the top-most button in the display
    // don't know the previous select, so remove class btn-clicked from all, e.g., unselect all buttons
    document.getElementsByName("location").forEach((button) => {button.classList.remove('btn-clicked'); button.classList.add('btn-default');});
    // find button that matches idx
    console.log('changeLocation: '+idx.toString());
    document.getElementsByName("location").forEach((button) => { if (button.value == idx.toString()) {
        console.log('changeLocation matched');
        // now remove class btn-default from new selected button and add btn-clicked
        button.classList.remove('btn-default');
        button.classList.add('btn-clicked');
        }
    });
    
    var loc = locations[idx];
    storeLoc(loc);
    currentLocation = loc;
    radarSite = loc.getRadarStation();
    radarProd = radarSite+'_'+radarProduct;
    iconLayer = loc.getMarkerLayer();
    getCapabilities();
}

function killAllTimers() {
    if (animationIntervalId) {
		clearInterval(animationIntervalId);
        animationIntervalId = null;
    }
    if (refreshTimerId) {
        clearTimeout(refreshTimerId);
        refreshTimerId = null;
    }
}

// Process WmsCapabilities obtained from WMS request.
// It sets some global vars.
// return allTimesArr: all of the times that past images are available (usually 2 to 4 hours every 10 minutes)
// NOTE: more friendly syntax than using XML
function processWmsCapabilities(wmsCap) {
	// Create 'result' object corresponding to XML returned from GetCapabilities
	var parser = new WMSCapabilities();
	var result = parser.read(wmsCap);
	if(!result) throw new Error('Error parsing WMS Capabilites XML');
	//console.log('WMSCapabilitie result'); console.dir(result);

	// Get Layer corresponding to radar site/product
	var layer = result.Capability.Layer.Layer.find( Layer => { return Layer.Name === radarProd } );
	if (!layer) throw new Error('Layer for '+radarProd+' not found');
    wmsLayer = layer;   // global
	// Log the Layer abstract
	console.log('Abstract: '+layer.Abstract);

	// Get Dimension (containing default time, and array of time values)
    // TODO: should not use Dimension[0], instead get Dimension name=time?
	//var timeDimension = layer.Dimension[0];
	var timeDimension = layer.Dimension.find( Dimension => {return Dimension.name === 'time' } );
	if (!timeDimension) throw new Error('Dimension not found');

	// Get default time for Dimensions
	var defaultTimeStr = timeDimension.default;
	if (!defaultTimeStr) throw new Error('Default time not found');
	defaultTime = new Date(defaultTimeStr);
	//console.log('default time (XML string) = '+defaultTimeStr+', defaultTime (converted to Date) = '+defaultTime.toISOString());

	// Create array of Date values corresponding to GetCapabilities array of times, removing any older than our interest
	// All available times are in an array of strings, oldest first, newest last
	var allTimesStr = timeDimension.values.split(',');	// Convert string to array of (time) strings
	//console.log('allTimesStr.length = '+allTimesStr.length);
	var allTimesArr = new Array();
	for (var i=0; i < allTimesStr.length; i++) {
		var dateEntry = new Date(allTimesStr[i]);	// convert from ISOString to Date object
		allTimesArr.push(dateEntry);
    }
	//console.log('allTimesArr.length = '+allTimesArr.length);

	// Get map bounding box
	var boundingBox = layer.BoundingBox.find( BoundingBox => { return BoundingBox.crs === mapCRS } );
	if (!boundingBox) throw new Error('Layer bounding box not found for CRS = '+mapCRS);
	var mapbbox = boundingBox.extent;
	//console.log('bbox.extent = '+mapbbox.toString());
    bbox4326 = new Array(mapbbox[1],mapbbox[0],mapbbox[3],mapbbox[2]);

	// Calculate center for map
	if (latitudeCenter) var mapCenterLatitude = latitudeCenter;
	else var mapCenterLatitude = (Number(mapbbox[0])+Number(mapbbox[2]))/2.0;	// Assumes mapCRS is in lat/lon units
	if (longitudeCenter) var mapCenterLongitude = longitudeCenter;
	else var mapCenterLongitude = (Number(mapbbox[1])+Number(mapbbox[3]))/2.0;	// Assumes mapCRS is in lat/lon units
	var mapCenterCoordinate = fromLonLat([mapCenterLongitude, mapCenterLatitude], mapCRS);
	//console.log('mapCenterCoordinate = '+mapCenterCoordinate.toString());
    
    return allTimesArr;
}

function ajaxStateChange() {
    var ok = true;
    console.log('getCapabilities readyState = '+this.readyState);
    if (this.readyState != 4) {
        return;
    }
    else if (this.status == 200) {
        lastGetCapTime = new Date().getTime();
        //console.log('getCapabilities length = '+this.responseText.length);
        // wmsCap is a string representing XML. Convert to object.
        var wmsCap = this.responseText;
        try {
            var dtArr = processWmsCapabilities(wmsCap); // returns Array of radar image times
            //console.log('dtArr.length='+dtArr.length);
            // remove old times from array. dtArr may go back 4 hours, but we usually only want 1 hour.
            var earliest = nHoursAgo(animationMaxHours);
            //console.log('earliest = '+earliest.toISOString());
            allTimes = new Array();
            for (var i=0; i < dtArr.length; i++) {
                if (dtArr[i] > earliest) allTimes.push(dtArr[i]);
            }
            console.log('allTimes.length='+allTimes.length+', defaultTime='+defaultTime.toISOString());
            startupDisplay(autoPlay);   // fill in the page contents
        }
        catch (e)
        {
            time_error(e);
            ok = false;
        }
    }
    else {
        time_error('getCapabilities failure');
        lastGetCapTime = null;
        ok = false;
    }
    if (!ok) {
        // will need to run getCapabilities again
        if (refreshTimerId) {
            clearTimeout(refreshTimerId);
            refreshTimerId = null;
        }
        refreshTimerId = setTimeout(getCapabilities,retryShortTime);
    }
}

// Function to issue GetCapabiliteis to the server and obtain and process required information.
function getCapabilities() {
    // TODO: replace XMLHttpRequest with fetch: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
	var url = 'https://opengeo.ncep.noaa.gov/geoserver/'+radarSite+'/ows?service=wms&version=1.3.0&request=GetCapabilities';
	var xhttp = new XMLHttpRequest();
	//console.log('getCapabilities: start');
    startGetCapabilities = new Date().getTime();    // measure how long it takes (milliseconds)
	xhttp.onreadystatechange = ajaxStateChange; // callback to process returned data
	xhttp.open("GET", url, true);
	xhttp.send();
}

// update legend in DOM
function updateLegend(resolution) {
	var graphicUrl = wmsLayerSource.getLegendUrl(resolution, {layer: radarProd});
	//console.log('graphicUrl = '+graphicUrl);
	mapLegendElement.src = graphicUrl;
}

// start map display
function startupDisplay(autoPlay) {

	// Calculate center for map
	var latitudeCenter = (Number(bbox4326[0])+Number(bbox4326[2]))/2.0;
	var longitudeCenter = (Number(bbox4326[1])+Number(bbox4326[3]))/2.0;
	var center4326 = new Array(latitudeCenter,longitudeCenter);
	//nsole.log('center4326 = '+center4326.toString());
	var center3857 = transform(center4326, 'EPSG:4326', 'EPSG:3857');

	// Map boundaries given by RidgeII for radar site, bottom left and top right corners
	var bbox3857 = transformExtent(bbox4326, 'EPSG:4326', 'EPSG:3857');
	//nsole.log('bbox3857 = '+bbox3857.toString());
	var bboxStr0 = bbox3857[0].toString();
	var bboxStr1 = bbox3857[1].toString();
	var bboxStr2 = bbox3857[2].toString();
	var bboxStr3 = bbox3857[3].toString();
	// EPSG:3857 wants to get the bounding box in latitude,longitude, so rearrange
	var bboxStr=bboxStr1+','+bboxStr0+','+bboxStr3+','+bboxStr2;

    // the base layer, it's from a world map
	var layerOSM = new TileLayer({source: new OSM()});

    // radar image layer
	var wmsSource = new ImageWMS({
		url: 'https://opengeo.ncep.noaa.gov/geoserver/'+radarSite+'/ows',
		params: {'service': 'WMS', 'version':'1.3.0', 'request':'GetMap','layers':radarProd,'style':wmsImageStyle,'crs':'EPSG:3857',
			'bbox':bboxStr,'format':'image/gif','width':radarWidth,'height':radarHeight,'transparent':'true'},
		serverType: 'geoserver',
		crossOrigin: 'anonymous',
	});
	wmsLayerSource = wmsSource;

	var wmsImageLayer = new ImageLayer({
		source: wmsLayerSource,
	});
    
	var legendImg = document.getElementById('legend');

	var mapView = new View({
		projection: 'EPSG:3857',
		center: center3857,
		zoom: radarZoom,
	});

	// Set map legend on DOM element, if needed in HTML
	if (legendImg) {
		if (useLegendApi) updateLegend(mapView.getResolution());	// Initial legend using API
		else {
			// Update legend in DOM with URL from GetCapabilities
			let onlineResourceHref = wmsLayer.Style[0].LegendURL[0].OnlineResource;
			if (!onlineResourceHref) onlineResourceHref = 'data:,';
			//nsole.log('onlineResourceHref = '+onlineResourceHref);
			legendImg.src = onlineResourceHref;
        }
    }
	//console.log('iconLayer='+iconLayer);
	displayLayers = [layerOSM, wmsImageLayer, iconLayer];
    if (displayMap) {
        // Need to clear the DIV before updating entire Map object
        document.getElementById('map').innerHTML = "";
    }
    displayMap = new Map({
        layers: displayLayers,
        target: 'map',
        view: mapView,
        controls: [new Zoom(),],
    });
    // TODO: look for renderComplete to make a Loading indicator. Or Map.render
	
    // Calculate remaining time until next refresh: GetCapabilities can take many seconds
    endGetCapabilities = new Date().getTime();
	var remainingMilliseconds = (refreshMinutes * 60 * 1000) - (endGetCapabilities - startGetCapabilities);
    console.log('setTimeout for getCapabilities: '+remainingMilliseconds.toString());
	if (remainingMilliseconds > 0) {
        if (refreshTimerId) { clearTimeout(refreshTimerId); refreshTimerId = null; }
        refreshTimerId = setTimeout(getCapabilities, remainingMilliseconds);
    }
    
    if (autoPlay) {
        play();
    }
}

// set date/time for the next timed layer and load new WMS image
function nextLayer() {
	startDateIdx += 1;
	if (startDateIdx >= allTimes.length) startDateIdx = 0;
	startTime = allTimes[startDateIdx];
	// update the TIME param for the WMS layer
	displayLayers[1].getSource().updateParams({'TIME': startTime.toISOString()});
	var el = document.getElementById('time_info');
	//el.innerHTML = startTime.toLocaleString();
	el.innerHTML = startTime.toLocaleString("en-US", {timeZone:currentLocation.time_zone, timeZoneName:"short"});
}

// calculate 'one hour ago' for animation (from https://openlayers.org/en/latest/examples/wms-time.html)
function nHoursAgo(nHour) {
    var milli = Math.round(3600000 * nHour);    // nHour can be float
	return new Date(Date.now() - milli);	// 3600000 milliseconds in an hour
}

// Function to stop animation
function stop() {
    //console.log('button: stop');
	if (animationIntervalId !== null) {
		clearInterval(animationIntervalId);
		animationIntervalId = null;
	}
};

// Function to play animation
function play() {
    //console.log('button: play');
	stop();
	animationIntervalId = setInterval(nextLayer, 1000 / frameRate);
};

// stop animation and set image to latest
function stopLatest() {
    stop();
    if (defaultTime) {
        displayLayers[1].getSource().updateParams({'TIME': defaultTime.toISOString()});
        var el = document.getElementById('time_info');
       	el.innerHTML = defaultTime.toLocaleString("en-US", {timeZone: currentLocation.time_zone, timeZoneName:"short"});
    }
    else {
        time_warn('stopLatest: defaultTime is null');
    }
}

function image_timer() {
    if (defaultTime) {
        var elem = document.getElementById('img_timer');
        var now = Date.now();
        var then = new Date(defaultTime);
        var tdiff = now - then;     // milliseconds
        var str0 = new Date(tdiff).toISOString().substr(11,8);
        var str1 = str0.replace(':','h');
        var str2 = str1.replace(':','m');
        str2 += 's';
        if (str2.startsWith('00')) str2 = str2.substr(3,6);
        elem.innerHTML = str2;

        // Something went wrong and we're not fetching new Capabilities.
        // If more than 2*refresh time, then force a retry.
        if (lastGetCapTime && (now-lastGetCapTime) > (60 * 1000 * 2 * refreshMinutes)) {
            //console.log('image_timer: tdiff=%s',(tdiff/1000.0).toFixed(1));
            time_warn('image_timer: watchdog triggered');
            if (refreshTimerId) {
                // kill the timer
                clearTimeout(refreshTimerId);
                refreshTimerId = null;
                getCapabilities();
            }
        }
    }
}

// call this function when onLoad is complete
function kickOffDisplay() {
    
    // look for request params
    var home_name = get_req('home_name');
    var home_idx = 0;
    if (home_name === undefined) home_idx = 0;
    else {
        for (var i=0; i < locations.length; i++) {
            if (home_name == locations[i].getHomeName()) {
                home_idx = i;
                break;
            }
        }
    }
    // changeLocation forces getCapabilities to run and that will update entire page.
    changeLocation(home_idx);  // always start with location 0, assumed to be your home
    var radar_type = get_req('radar_type');
    if (radar_type === undefined) radar_type = 'bref_raw';
    changeRadar(radar_type);
    
    // Do not ever kill image_timer, because it also functions as a watchdog
    var timerId = setInterval(image_timer, 1000);
}
