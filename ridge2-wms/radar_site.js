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
import Style from 'ol/style/Style';
import Icon from 'ol/style/Icon';

//Configuration information
var radarSite    = 'kmux';	// Radar site
var radarProduct = 'cref';	// Radar product
var radarZoom    = 7;		// Radar initial zoom
var radarWidth   = '400px';	// Radar map width
var radarHeight  = '300px';	// Radar map height
var style        = 'radar_reflectivity';	// should fetch this from capabilities
var mapMarker    = true;			// Flag to place marker on map
var homeLoc      = [-121.97259,36.99283];	// your house

var radarProd = radarSite+'_'+radarProduct;

console.log('start '+radarProduct);

var xmlCap = null;
var defaultTime = null;
var startDateIdx = 0;
var startDate = null;
var frameRate = 1.0; // frames per second
var animationId = null;
var allTimes = null;	// Array of datetime from GetCapabilities, converted to Date objects
var BoundingBoxArray = null;
var savedLayers = null;

var home3857 = transform(homeLoc, 'EPSG:4326', 'EPSG:3857');
//var home3857 = fromLonLat(homeLoc);
var iconFeature = new Feature({
  geometry: new Point([home3857[0],home3857[1]]),
  name: 'HOME',
});

// Create map marker icon (Reference: ol.style.Icon)
const bigHouseSource = 'https://openlayers.org/en/latest/examples/data/icon.png';
var bigHouseIcon = new Icon({
	anchor: [0.5, 46],
	anchorXUnits: 'fraction',
	anchorYUnits: 'pixels',
	src: bigHouseSource
});

const redDotSource = 'https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg';	// Marker anchor icon URL
var redDotIcon = new Icon({
	anchor: [0.5, 0.5],
	anchorXUnits: 'fraction',
	anchorYUnits: 'fraction',
	src: redDotSource
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

// wmsCap is a string representing XML. Use DOMparser and access the nodes.
function processXmlCapabilities(wmsCap) {
	var domParser = new DOMParser();
	xmlCap = domParser.parseFromString(wmsCap, "text/xml");
	dtArray = processCapabilities(xmlCap);
	return dtArray;
}

// wmsCap is a string representing XML. Use WMSCapabilities to access the nodes as properties of an Object.
function processWmsCapabilities(wmsCap) {
	// Create 'result' object corresponding to XML returned from GetCapabilities
	var parser = new WMSCapabilities();
	var result = parser.read(wmsCap);
	if(!result) throw new Error('Error parsing WMS Capabilites XML');
	// Get Layer coresponding to radar site/product
	// In XML parlance, find a Layer node with child node Name with value radarSiteProd
	var layer = result.Capability.Layer.Layer.find( Layer => { return Layer.Name === radarSiteProd } )
	if (!layer) throw new Error('Layer for '+radarSiteProd+' not found');

	// Get bounding box
	var boundingBox = layer.BoundingBox.find( BoundingBox => { return BoundingBox.crs === 'CRS:84' } );
	if (!boundingBox) throw new Error('BoundingBox not found');
}

// Function to issue GetCapabiliteis to the server and obtain and process required information.
function getCapabilities() {
	var url = 'https://opengeo.ncep.noaa.gov/geoserver/'+radarSite+'/ows?service=wms&version=1.3.0&request=GetCapabilities';
	var xhttp = new XMLHttpRequest();
	console.log('getCapabilities: start');
	xhttp.onreadystatechange = function() {
		if (this.readyState != 4) {
			console.log('getCapabilities readyState = '+this.readyState);
			return;
		}
		else if (this.status == 200) {
		   // Typical action to be performed when the document is ready:
		   //document.getElementById("demo").innerHTML = xhttp.responseText;
		   console.log('getCapabilities length = '+xhttp.responseText.length);
            // wmsCap is a string representing XML. Convert to object.
		    wmsCap = xhttp.responseText;
			var domParser = new DOMParser();
			xmlCap = domParser.parseFromString(wmsCap, "text/xml");
			dtArray = processCapabilities(xmlCap);
			// remove old times from array
			earliest = nHoursAgo(1);
			console.log('earliest = '+earliest.toISOString());
			allTimes = new Array();
			for (i=0; i < dtArray.length; i++) {
				if (dtArray[i] > earliest) allTimes.push(dtArray[i]);
			}
			defaultTime = allTimes[allTimes.length - 1];
			console.log('allTimes.length='+allTimes.length+', defaultTime='+defaultTime.toISOString());
			var dt = defaultTime;
			var info = document.getElementById('info');
			info.innerHTML = dt.toLocaleString();
            startupDisplay();
		}
		else {
			console.log('getCap failure');
		}
	};
	xhttp.open("GET", url, true);
	xhttp.send();
}

// Function to process information obtained from GetCapabilities
function processCapabilities(xmlCap) {
	var layers = xmlCap.getElementsByTagName('Layer');
	console.log('number of Layer = '+layers.length);
	var node = null;
	var layer = null;
	var gotit = false;
	
	for (i = 0; i < layers.length; i++) {
		layer = layers[i];
		if (gotit) break;	// no need to look at additional layers
		//console.log(layer.nodeName+' '+i);
		if (layer.getAttribute('queryable') == null) continue;
		for (j = 0; j < layer.childNodes.length; j++) {
			node = layer.childNodes[j];
			//console.log(node.nodeName);
			//if (node.nodeName == 'Name') console.log('Name = '+node.childNodes[0].nodeValue);
			if (node.nodeName == 'Name' && node.childNodes[0].nodeValue == radarProd) {
				gotit = true;
				console.log('found '+radarProd);
			}
			if (gotit) {
				if (node.nodeName == 'Abstract') {
					console.log('abstract: '+node.childNodes[0].nodeValue);
					//break;
				}
				if (node.nodeName == 'BoundingBox' && node.getAttribute('CRS') == 'CRS:84') {
					var minx = node.getAttribute('minx');
					var miny = node.getAttribute('miny');
					var maxx = node.getAttribute('maxx');
					var maxy = node.getAttribute('maxy');
                    BoundingBoxArray = new Array(minx,miny,maxx,maxy);
					//break;
				}
				if (node.nodeName == 'Dimension' && node.getAttribute('name') == 'time') {
					dt = node.getAttribute('default');
					console.log('time = '+dt);
					// all available times in an array of strings, oldest first, newest lastChild
					var allTimesStr = node.childNodes[0].nodeValue.split(',');	// Array of times
					break;
				}

			}
		}
	}
	console.log('processCapabilities: allTimesStr.length='+allTimesStr.length);
	dtArray = new Array();
	for (i=0; i < allTimesStr.length; i++) {
		dtArray.push(new Date(allTimesStr[i]));	// convert from ISOString to Date object
	}
	return dtArray;
}

// Function to start map display
function startupDisplay() {

	var startButton = document.getElementById('play');
	startButton.addEventListener('click', play, false);

	var stopButton = document.getElementById('pause');
	stopButton.addEventListener('click', stop, false);

	// Map boundaries given by RidgeII for radar site, bottom left and top right corners
	var bbox4326 = [...BoundingBoxArray];
	console.log('bbox4326 = '+bbox4326.toString());
	var bbox3857 = transformExtent(bbox4326, 'EPSG:4326', 'EPSG:3857');
	console.log('bbox3857 = '+bbox3857.toString());
	var bboxStr0 = bbox3857[0].toString();
	var bboxStr1 = bbox3857[1].toString();
	var bboxStr2 = bbox3857[2].toString();
	var bboxStr3 = bbox3857[3].toString();
	// EPSG:3857 wants to get the bounding box in latitude,longitude, so rearrange
	var bboxAll=bboxStr1+','+bboxStr0+','+bboxStr3+','+bboxStr2;

        // Set the source and parameters for map
	var wmsSource = new ImageWMS({
		url: 'https://opengeo.ncep.noaa.gov/geoserver/'+radarSite+'/ows',
		params: {'service': 'WMS', 'version':'1.3.0', 'request':'GetMap','layers':radarProd,'style':style,'crs':'EPSG:3857',
			'bbox':bboxAll,'format':'image/png','width':radarWidth,'height':radarHeight,'transparent':'true'},
		serverType: 'geoserver',
		crossOrigin: 'anonymous',
	});
	
	var legendUrl = "https://opengeo.ncep.noaa.gov:443/geoserver/styles/reflectivity.png";
	var resolution = undefined;
	//var legendUrl = wmsSource.getLegendUrl(resolution);
	console.log('legendUrl = '+legendUrl);	console.log('legendUrl = '+legendUrl);
	var img = document.getElementById('legend');
	img.src = legendUrl;
	
	layerOSM = new TileLayer({source: new OSM()});

	var wmsLayer = new ImageLayer({
		source: wmsSource,
	});
	console.log('iconLayer='+iconLayer);
	savedLayers = [layerOSM, wmsLayer, iconLayer];
	//savedLayers = [layerOSM, iconLayer];
	
	//markerLayer = getMarkerLayer();
	//if (markerLayer) savedLayers.push(markerLayer);
	//savedLayers.push(iconLayer);

	// Calculate center for map
	var latitudeCenter = (Number(BoundingBoxArray[0])+Number(BoundingBoxArray[2]))/2.0;
	var longitudeCenter = (Number(BoundingBoxArray[1])+Number(BoundingBoxArray[3]))/2.0;
	var center4326 = new Array(latitudeCenter,longitudeCenter);
	console.log('center4326 = '+center4326.toString());
	var center3857 = transform(center4326, 'EPSG:4326', 'EPSG:3857');

	var view = new View({
		projection: 'EPSG:3857',
		center: center3857,
		zoom: radarZoom,
	});

	var map = new Map({
		layers: savedLayers,
		target: 'map',
		view: view,
	});
	//map.addLayer(iconLayer);
}

// Function to set date/time for the next timed layer
function setTime() {
	startDateIdx += 1;
	if (startDateIdx >= allTimes.length) startDateIdx = 0;
	startDate = allTimes[startDateIdx];
	// update the TIME param for the WMS layer
	savedLayers[1].getSource().updateParams({'TIME': startDate.toISOString()});
	var el = document.getElementById('info');
	el.innerHTML = startDate.toLocaleString();
}

// functions to calculate 'one hour ago' for animation (from https://openlayers.org/en/latest/examples/wms-time.html)
function nHoursAgo(nHour) {
	return new Date(Date.now() - 3600000 * nHour);	// 3600000 milliseconds in an hour
}

/*
var updateLegend = function (resolution) {
  var graphicUrl = wmsSource.getLegendUrl(resolution);
  var img = document.getElementById('legend');
  img.src = graphicUrl;
};
*/

// Function to play animation
var play = function () {
	stop();
	animationId = window.setInterval(setTime, 1000 / frameRate);
};

// Function to stop animation
var stop = function () {
	if (animationId !== null) {
		window.clearInterval(animationId);
		animationId = null;
	}
};

// Get capabilities for radar site WMS and process returned information.
// Completion of GetCapabilites web request drives remainder of program initialization and execution.
getCapabilities();
