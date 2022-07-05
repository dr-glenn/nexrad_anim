import 'elm-pep';
import 'ol/ol.css';
import ImageLayer from 'ol/layer/Image';
import ImageWMS from 'ol/source/ImageWMS';
import Map from 'ol/Map';
import View from 'ol/View';
import Tile from 'ol/layer';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import {transform} from 'ol/proj';	// use curly-brace to import a function

/*
*/
var wmsSource = new ImageWMS({
  url: 'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows',
  params: {'service': 'WMS', 'version':'1.3.0', 'request':'GetMap','layers':'conus_bref_qcd','style':'','crs':'EPSG:3857',
      'bbox':'20.0,-130.0,55.0,-60.0','format':'image/png','width':'600px','height':'600px'},
  serverType: 'geoserver',
  crossOrigin: 'anonymous',
});

var wmsLayer = new ImageLayer({
  source: wmsSource,
});

var center4326 = [-100.0,35.0];
var center3857 = transform(center4326, 'EPSG:4326', 'EPSG:3857');

var view = new View({
  projection: 'EPSG:3857',
  center: center3857,
  zoom: 4,
});

var layerOSM = new TileLayer({source: new OSM()});

var map = new Map({
  layers: [layerOSM,wmsLayer],
  target: 'map',
  view: view,
});


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

function getCap() {
    // specifically conus_bref_qcd
	var url =    'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?service=wms&version=1.3.0&request=GetCapabilities';
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

