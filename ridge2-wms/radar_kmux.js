import 'elm-pep';
import 'ol/ol.css';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import Map from 'ol/Map';
import View from 'ol/View';
import Tile from 'ol/layer';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import WMSCapabilities from 'ol/format/WMSCapabilities';
import {transform} from 'ol/proj';	// use curly-brace to import a function
import {transformExtent} from 'ol/proj';

console.log('start radar_kmux');

var xmlCap = null;
var defaultTime = null;
var startDateIdx = 0;
var startDate = null;
var frameRate = 1.0; // frames per second
var animationId = null;
var allTimes = null;	// Array of datetime from GetCapabilities, converted to Date objects

// this function not used. I don't know how to use WMSCapabilities
function getCapabilities() {
	var url = 'https://opengeo.ncep.noaa.gov/geoserver/kmux/ows';
	var wmsCap = new WMSCapabilities({
		url: url,
		params: {'service': 'WMS', 'version':'1.3.0', 'request':'GetCapabilities' }
	});
	//var wmsCap = new WMSCapabilities().parse();
	// wmsCap is a string representing XML. Convert to object.
	var domParser = new DOMParser();
	var xmlCap = domParser.parseFromString(wmsCap, "text/xml");
	console.log('wmsCap length = '+wmsCap.length);
	return xmlCap;
}

function getDefaultTime(xmlCap) {
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
			if (node.nodeName == 'Name' && node.childNodes[0].nodeValue == 'kmux_bref_raw') {
				gotit = true;
				console.log('found kmux_bref_raw');
			}
			if (gotit) {
				if (node.nodeName == 'Abstract') {
					console.log('abstract: '+node.childNodes[0].nodeValue);
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
	console.log('getDefaultTime: allTimesStr.length='+allTimesStr.length);
	dtArray = new Array();
	for (i=0; i < allTimesStr.length; i++) {
		dtArray.push(new Date(allTimesStr[i]));	// convert from ISOString to Date object
	}
	return dtArray;
}

function getCap() {
	var url = 'https://opengeo.ncep.noaa.gov/geoserver/kmux/ows?service=wms&version=1.3.0&request=GetCapabilities';
	var xhttp = new XMLHttpRequest();
	console.log('getCap: start');
	xhttp.onreadystatechange = function() {
		if (this.readyState != 4) {
			console.log('getCap readyState = '+this.readyState);
			return;
		}
		else if (this.status == 200) {
		   // Typical action to be performed when the document is ready:
		   //document.getElementById("demo").innerHTML = xhttp.responseText;
		   console.log('getCap length = '+xhttp.responseText.length);
		   wmsCap = xhttp.responseText;
			// wmsCap is a string representing XML. Convert to object.
			var domParser = new DOMParser();
			xmlCap = domParser.parseFromString(wmsCap, "text/xml");
			dtArray = getDefaultTime(xmlCap);
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
		}
		else {
			console.log('getCap failure');
		}
	};
	xhttp.open("GET", url, true);
	xhttp.send();
}

// functions for animation from https://openlayers.org/en/latest/examples/wms-time.html
function nHoursAgo(nHour) {
  return new Date(Date.now() - 3600000 * nHour);
}

var stop = function () {
  if (animationId !== null) {
    window.clearInterval(animationId);
    animationId = null;
  }
};

var play = function () {
  stop();
  animationId = window.setInterval(setTime, 1000 / frameRate);
};

function setTime() {
	startDateIdx += 1;
	if (startDateIdx >= allTimes.length) startDateIdx = 0;
	startDate = allTimes[startDateIdx];
	layers[1].getSource().updateParams({'TIME': startDate.toISOString()});
	updateInfo();
}

var startButton = document.getElementById('play');
startButton.addEventListener('click', play, false);

var stopButton = document.getElementById('pause');
stopButton.addEventListener('click', stop, false);
/*
*/

function updateInfo() {
  var el = document.getElementById('info');
  el.innerHTML = startDate.toLocaleString();
}

// These are the map boundaries given by RidgeII for KMUX, bottom left and top right corners
bbox4326 = [-126.898,32.1542,-116.8972,42.155];
console.log('bbox4326 = '+bbox4326.toString());
bbox3857 = transformExtent(bbox4326, 'EPSG:4326', 'EPSG:3857');
console.log('bbox3857 = '+bbox3857.toString());
bboxStr0 = bbox3857[0].toString();
bboxStr1 = bbox3857[1].toString();
bboxStr2 = bbox3857[2].toString();
bboxStr3 = bbox3857[3].toString();
// EPSG:3857 wants to get the bounding box in latitude,longitude, so I have to rearrange
bboxAll=bboxStr1+','+bboxStr0+','+bboxStr3+','+bboxStr2;
var wmsSource = new ImageWMS({
  url: 'https://opengeo.ncep.noaa.gov/geoserver/kmux/ows',
  params: {'service': 'WMS', 'version':'1.3.0', 'request':'GetMap','layers':'kmux_bref_raw','style':'','crs':'EPSG:3857',
      'bbox':bboxAll,'format':'image/png','width':'600px','height':'600px'},
  serverType: 'geoserver',
  crossOrigin: 'anonymous',
});

layerOSM = new TileLayer({source: new OSM()});

var wmsLayer = new ImageLayer({
  source: wmsSource,
});
var layers = [layerOSM, wmsLayer];

center4326 = [-121.9,37.15];
center3857 = transform(center4326, 'EPSG:4326', 'EPSG:3857');

var view = new View({
  projection: 'EPSG:3857',
  center: center3857,
  zoom: 8,
});

var map = new Map({
  layers: layers,
  target: 'map',
  view: view,
});

// GetCapabilities for radar site and parse for some values, especially time.
getCap();
//xml = getCapabilities();
//getDefaultTime(xml);
