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

/*
const { JSDOM } = require("jsdom");
const { window } = new JSDOM("");
const {document } = (new JSDOM('')).window;
global.document = document;
var $ = jQuery = require("jquery")(window);
*/
import $ from 'jquery';
window.jQuery = window.$ = $;

//Configuration information
var radarSite    = 'kmux';	// Radar site
var radarProduct = 'bref_raw';	// Radar product
var radarZoom    = 7;		// Radar initial zoom
var radarWidth   = '400px';	// Radar map width
var radarHeight  = '300px';	// Radar map height
var wmsImageStyle = 'radar_reflectivity';	// should fetch this from capabilities
var autoPlay	 = true;	// true: startup with animation
const mapCRS	 = 'EPSG:4326';		// Map coordinate reference system - Note: map center calculation below 
var radarProd = radarSite+'_'+radarProduct; // can be changed with buttons
var animationMaxHours	= 1;			// Maximum hours for animation data
// TODO: next 2 should nt be used
var latitudeCenter		= 0;			// Map latitude center, zero means use radar site center
var longitudeCenter		= 0;			// Map longitude center, zero means use radar site center
var wmsLayerSource = null;
var wmsLayer = null;
var displayMap = null;  // OL Map object displayed in a DIV
const useLegendApi		= false;		// Use legend API to get legend URL or, if false, use legend URL in GetCapabilities

var defaultTime = null;     // from WMSCapabilities, the most recent radar time
var allTimes = null;	// Array of datetime from WMSCapabilities, converted to Date objects
var startDateIdx = 0;
var startTime = null;   // a Date-Time value from WMSCapabilities
var frameRate = 1.0; // frames per second
var animationId = null; // when not null, animation is running
var bbox4326 = null;    // bounding box in 4326 coordinates
var displayLayers = null;   // Array of layers in the Map display
var timeZone = "America/Los_Angeles";
var startGetCapabilities = 0;   // time the lengthy getCapabilities call
var endGetCapabilities = 0;     // finish the lengthy getCapabilies call
var refreshMinutes = 5;         // how often to perform GetCapabilities
var CountTimer = 0;     // time since most recent image in seconds

console.log('start '+radarProduct);

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
    createLocationButtons();
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

function radarClick() {
    document.getElementsByName("radar_product").forEach((button) => {button.classList.remove('btn-clicked'); button.classList.add('btn-default');});
    this.classList.remove('btn-default');
    this.classList.add('btn-clicked');
    radarProduct = this.value;
    radarProd = radarSite+'_'+radarProduct;
    getCapabilities();
}

function locationClick() {
    document.getElementsByName("location").forEach((button) => {button.classList.remove('btn-clicked'); button.classList.add('btn-default');});
    this.classList.remove('btn-default');
    this.classList.add('btn-clicked');
    changeLocation(this.value);
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
    constructor(name, lon_lat, radar_sta, time_zone) {
        this.name = name;   // use name to display a button in the UI
        this.lon_lat = lon_lat; // display a marker at the home
        this.radar_sta = radar_sta;
        this.loc3857 = transform(this.lon_lat, 'EPSG:4326', 'EPSG:3857');
        this.time_zone = time_zone; // at the home location
    }
    getHomeName() { return this.name; }
    
    getMarkerLayerOld() {
        var iconFeature = new Feature({
            geometry: new Point([this.loc3857[0],this.loc3857[1]]),
            name: 'HOME',
        });
        var iconLayer = new VectorLayer({
            source: new VectorSource({
                features: [iconFeature]
            }),
            zIndex: 11,
            style: new Style({
                image: redDotIcon
            })
        });
        return iconLayer;
    }
    
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

var homeDover = new HomeLocation('Dover', [-121.97259,36.99283], 'kmux', "America/Los_Angeles");
var homeLolita = new HomeLocation('Sue', [-75.85384,42.16405], 'kbgm', "America/New_York");
var homeBobSeattle = new HomeLocation('Bob', [-122.03546,47.55889], 'katx', "America/Los_Angeles");
var portlandLoc = new HomeLocation('Portland', [-122.68334,45.51689], 'krtx', "America/Los_Angeles");

// Location buttons are created from this Array and ordered on screen from 0 to N
var locations = new Array();
locations.push(homeDover);
locations.push(homeLolita);
locations.push(homeBobSeattle);
locations.push(portlandLoc);
var currentLocation = null; // will be set when changeLocation is called

function changeLocation(idx) {
    // idx value 0 is the top-most button in the display
    loc = locations[idx];
    currentLocation = loc;
    radarSite = loc.getRadarStation();
    radarProd = radarSite+'_'+radarProduct;
    iconLayer = loc.getMarkerLayer();
    getCapabilities();
}

// Process WmsCapabilities obtained from WMS request
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
	console.log('default time (XML string) = '+defaultTimeStr+', defaultTime (converted to Date) = '+defaultTime.toISOString());

	// Get earliest possible time to use for animation
	if (animationMaxHours) {
		var earliest = new Date(Date.now() - 3600000 * animationMaxHours);
		console.log('Earliest possible time to use for animation = '+earliest.toISOString());
    }
	else var earliest = 0;

	// Create array of Date values corresponding to GetCapabilities array of times, removing any older than our interest
	// All available times are in an array of strings, oldest first, newest last
	var allTimesStr = timeDimension.values.split(',');	// Convert string to array of (time) strings
	console.log('allTimesStr.length = '+allTimesStr.length);
	allTimesArr = new Array();
	for (var i=0; i < allTimesStr.length; i++) {
		var dateEntry = new Date(allTimesStr[i]);	// convert from ISOString to Date object
		allTimesArr.push(dateEntry);
    }
	console.log('allTimesArr.length = '+allTimesArr.length);

	// Get map bounding box
	var boundingBox = layer.BoundingBox.find( BoundingBox => { return BoundingBox.crs === mapCRS } );
	if (!boundingBox) throw new Error('Layer bounding box not found for CRS = '+mapCRS);
	var mapbbox = boundingBox.extent;
	console.log('bbox.extent = '+mapbbox.toString());
    bbox4326 = new Array(mapbbox[1],mapbbox[0],mapbbox[3],mapbbox[2]);

	// Calculate center for map
	if (latitudeCenter) var mapCenterLatitude = latitudeCenter;
	else var mapCenterLatitude = (Number(mapbbox[0])+Number(mapbbox[2]))/2.0;	// Assumes mapCRS is in lat/lon units
	if (longitudeCenter) var mapCenterLongitude = longitudeCenter;
	else var mapCenterLongitude = (Number(mapbbox[1])+Number(mapbbox[3]))/2.0;	// Assumes mapCRS is in lat/lon units
	var mapCenterCoordinate = fromLonLat([mapCenterLongitude, mapCenterLatitude], mapCRS);
	console.log('mapCenterCoordinate = '+mapCenterCoordinate.toString());
    
    return allTimesArr;
}

function ajaxStateChange() {
    if (this.readyState != 4) {
        console.log('getCapabilities readyState = '+this.readyState);
        return;
    }
    else if (this.status == 200) {
       // Typical action to be performed when the document is ready:
       //document.getElementById("demo").innerHTML = xhttp.responseText;
       console.log('getCapabilities length = '+this.responseText.length);
        // wmsCap is a string representing XML. Convert to object.
        wmsCap = this.responseText;
        dtArr = processWmsCapabilities(wmsCap); // returns Array of radar image times
        console.log('dtArr.length='+dtArr.length);
        // remove old times from array
        earliest = nHoursAgo(animationMaxHours);
        console.log('earliest = '+earliest.toISOString());
        allTimes = new Array();
        for (i=0; i < dtArr.length; i++) {
            if (dtArr[i] > earliest) allTimes.push(dtArr[i]);
        }
        console.log('allTimes.length='+allTimes.length+', defaultTime='+defaultTime.toISOString());
        startupDisplay(autoPlay);   // fill in the page contents
    }
    else {
        console.log('getCap failure');
    }
}
// Function to issue GetCapabiliteis to the server and obtain and process required information.
function getCapabilities() {
    // TODO: replace XMLHttpRequest with fetch: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
	var url = 'https://opengeo.ncep.noaa.gov/geoserver/'+radarSite+'/ows?service=wms&version=1.3.0&request=GetCapabilities';
	var xhttp = new XMLHttpRequest();
	console.log('getCapabilities: start');
    startGetCapabilities = new Date().getTime();    // measure how long it takes (milliseconds)
	xhttp.onreadystatechange = ajaxStateChange; // callback to process returned data
	xhttp.open("GET", url, true);
	xhttp.send();
}

// update legend in DOM
function updateLegend(resolution) {
	var graphicUrl = wmsLayerSource.getLegendUrl(resolution, {layer: radarProd});
	console.log('graphicUrl = '+graphicUrl);
	mapLegendElement.src = graphicUrl;
}

// start map display
function startupDisplay(autoPlay) {

	// Calculate center for map
	var latitudeCenter = (Number(bbox4326[0])+Number(bbox4326[2]))/2.0;
	var longitudeCenter = (Number(bbox4326[1])+Number(bbox4326[3]))/2.0;
	var center4326 = new Array(latitudeCenter,longitudeCenter);
	console.log('center4326 = '+center4326.toString());
	var center3857 = transform(center4326, 'EPSG:4326', 'EPSG:3857');

	// Map boundaries given by RidgeII for radar site, bottom left and top right corners
	var bbox3857 = transformExtent(bbox4326, 'EPSG:4326', 'EPSG:3857');
	console.log('bbox3857 = '+bbox3857.toString());
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
			console.log('onlineResourceHref = '+onlineResourceHref);
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
    });
    // TODO: look for renderComplete to make a Loading indicator. Or Map.render
	
    // Calculate remaining time until next refresh: GetCapabilities can take many seconds
    endGetCapabilities = new Date().getTime();
	remainingMilliseconds = (refreshMinutes * 60 * 1000) - (endGetCapabilities - startGetCapabilities);
	if (remainingMilliseconds > 0) refreshId = setTimeout(getCapabilities, remainingMilliseconds);
    
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
	return new Date(Date.now() - 3600000 * nHour);	// 3600000 milliseconds in an hour
}

// Function to stop animation
function stop() {
    //console.log('button: stop');
	if (animationId !== null) {
		clearInterval(animationId);
		animationId = null;
	}
};

// Function to play animation
function play() {
    //console.log('button: play');
	stop();
	animationId = setInterval(nextLayer, 1000 / frameRate);
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
        console.log('stopLatest: defaultTime is null');
    }
}

function image_timer() {
    if (defaultTime) {
        var elem = document.getElementById('img_timer');
        var now = Date.now();
        var then = new Date(defaultTime);
        var tdiff = now - then;     // milliseconds
        elem.innerHTML = new Date(tdiff).toISOString().substr(11,8);
    }
}

// Get capabilities for radar site WMS and process returned information.
// Completion of GetCapabilites web request drives remainder of program initialization and execution.
// changeLocation forces getCapabilities to run and that will update entire page.
changeLocation(0);  // always start with location 0, assumed to be your home.
var timerId = setInterval(image_timer, 1000);
