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
import Point from 'ol/geom/Point';
import Feature from 'ol/Feature';
import Icon from 'ol/style/Icon';
import VectorSource from 'ol/source/Vector';
import Style from 'ol/style/Style';
import VectorLayer from 'ol/layer/Vector';
import LayerGroup from 'ol/layer/Group';
import Collection from 'ol/Collection';

// Configuration information (these can be change from using the URL query string)

var location = 'Glenn'		// **********  Set this to 'Bob' or 'Glenn'

if (location == 'Bob') {
var radarSite			= 'katx';		// Radar site
var radarZoom			= 7;			// Radar zoom
var markerLatitude		= 47.55868;		// Marker latitude
var markerLongitude		= -122.03530;		// Marker longitude
var markerName			= 'Highland House';	// Marker name
}

if (location == 'Glenn') {
var radarSite			= 'kmux'		// Radar site
var radarZoom			= 7;			// Radar zoom
var markerLatitude		= 36.992903;		// Marker latitude
var markerLongitude		= -121.972606;		// Marker longitude
var markerName			= 'Glenn and Julia';	// Marker name
}

//var radarSiteProduct		= 'bref_raw';		// Radar product
var radarSiteProduct		= 'cref';		// Radar product
var mapMarker			= true;			// Flag to place marker on map
var animationframeRate		= 1.0;			// Frames per second for animation
var animationMaxHours		= 1;			// Maximum hours for animation data
var refreshMinutes		= 5;			// Minutes to refresh by issuing GetCapabilities
var autoPlay			= true;		// Flag to start in auto play mode

// Constants
const markerAnchor		= [0.5, 0.5]		// Marker anchor
const markerAnchorXUnits	= 'fraction'		// Units in which the anchor x value is specified
const markerAnchorYUnits	= 'fraction'		// Units in which the anchor y value is specified
const markerSource		= 'https://upload.wikimedia.org/wikipedia/commons/e/ec/RedDot.svg'	// Marker anchor icon URL

// Global variables
var radarSiteProd		= ''			// Combined site/product name
var markerIcon			= null;			// Map marker icon
var mapMarkerStyle		= null;			// Map marker style for vector layer
var mapMarkerPoint		= null;			// Map marker point
var mapMarkerFeature		= null;			// Map marker feature
var mapMarkerFeatureSource	= null;			// Map marker source of features for vector layer
var mapLayerOSM			= null;			// Open Street Map layer
var mapWmsSource		= null;			// Source and parameters for map
var mapLayerWMS			= null;			// Map WMS layer
var mapLayerMarker		= null;			// Map marker layer
var mapLayerArray		= null;			// Layers to display
var mapLayerCollection		= null;			// Collection of layers to display
var mapLayerGroup		= null;			// Layer group to display
var mapView			= null;			// Map view
var mapMap			= null;			// Map
var allTimesArray		= null;			// Array of Date objects corresponding to datetime's from GetCapabilities
var allTimesIndex		= 0;			// Current index into above array for animation
var animationId			= null;			// Animation interval timer identifier (so it can be stopped)
var controlsActive		= false;		// Indicate controls are not active
var refreshId			= 0			// Refresh timeout identifier
var enterGetCapabilitiesUTC	= 0;			// Time in milliseconds entered GetCapabilities
var autoPlayProcessed		= false;		// Flag that autoPlay has been processed

// Function to get URL parameter, log if present, and return value
function processUrlParameter(urlParams,parameterName) {
	var parameterValue = urlParams.get(parameterName);
	if (parameterValue != null) {
		if (!parameterValue) parameterValue = '(specified)';
		console.log(parameterName+' = '+parameterValue);
		return parameterValue;
	}
	return false;
}

// Function to process URL parameters (query string)
function processUrlParameters() {
	var parameterValue;
	var queryString = window.location.search;
	console.log('queryString = '+queryString);
	var urlParams = new URLSearchParams(queryString);
	if ((parameterValue = processUrlParameter(urlParams,'site')))			radarSite		= parameterValue;
	if ((parameterValue = processUrlParameter(urlParams,'product')))		radarSiteProduct	= parameterValue;
	if ((parameterValue = processUrlParameter(urlParams,'zoom')))			radarZoom		= Number(parameterValue);
	if ((parameterValue = processUrlParameter(urlParams,'mapmarker')))		mapMarker		= true;
	if ((parameterValue = processUrlParameter(urlParams,'nomapmarker')))		mapMarker		= false;
	if ((parameterValue = processUrlParameter(urlParams,'markerlatitude')))		markerLatitude		= Number(parameterValue);
	if ((parameterValue = processUrlParameter(urlParams,'markerlongitude')))	markerLongitude		= Number(parameterValue);
	if ((parameterValue = processUrlParameter(urlParams,'markername')))		markerName		= parameterValue;
	if ((parameterValue = processUrlParameter(urlParams,'framerate')))		animationframeRate	= parameterValue;
	if ((parameterValue = processUrlParameter(urlParams,'maxhours')))		animationMaxHours	= Number(parameterValue);
	if ((parameterValue = processUrlParameter(urlParams,'refreshminutes')))		refreshMinutes		= Number(parameterValue);
	if ((parameterValue = processUrlParameter(urlParams,'autoplay')))		autoPlay		= true;
	if ((parameterValue = processUrlParameter(urlParams,'noautoplay')))		autoPlay		= false;
}

// Function to issue GetCapabilites to the server and obtain and process required information.
function getCapabilities() {

	enterGetCapabilitiesUTC = new Date().getTime();		// Save the enter time in milliseconds

	radarSiteProd	= radarSite+'_'+radarSiteProduct;	// Get combined site/product name

	console.log('Start '+radarSiteProduct);			// Log script/refresh starting

	// Issue GetCapabilitites as a direct HTTP request to the WMS
	var url = 'https://opengeo.ncep.noaa.gov/geoserver/'+radarSite+'/ows?service=wms&version=1.3.0&request=GetCapabilities';
	var xhttp = new XMLHttpRequest();
	console.log('getCapabilities: start');
	xhttp.onreadystatechange = httpStateChange;
	xhttp.open("GET", url, true);
	xhttp.send();
}

// Function to handle GetCapabilities HTTP state change
function httpStateChange() {
	if (this.readyState == 4) {
		if (this.status == 200) {
			console.log('getCapabilities length = '+this.responseText.length);
			buildDisplayMap(this.responseText);
		}
		else throw new Error('Web request to WMS server for GetCapabilities failed');
	}
	else console.log('getCapabilities readyState = '+this.readyState);
};

// Function to build and display the map using information obtained from GetCapabilities
function buildDisplayMap(wmsCapabilitiesString) {

	// Create 'result' object corresponding to XML returned from GetCapabilities
	var parser = new WMSCapabilities();
	var result = parser.read(wmsCapabilitiesString);
	if(!result) throw new Error('Error parsing WMS Capabilites XML');
	//console.log('result');
	//console.dir(result);

	// Get Layer coresponding to radar site/product
	var layer = result.Capability.Layer.Layer.find( Layer => { return Layer.Name === radarSiteProd } )
	if (!layer) throw new Error('Layer for '+radarSiteProd+' not found');
	//console.log('layer');
	//console.dir(layer);

	// Log the Layer abstract if present
	console.log('Abstract: '+layer.Abstract);

	// Get Dimension (containing default time, and array of time values)
	var dimension = layer.Dimension[0];
	if (!dimension) throw new Error('Dimension not found');

	// Get default time for Dimensions
	var defaultTimeString = dimension.default;
	if (!defaultTimeString) throw new Error('Default time not found');
	console.log('default time = '+defaultTimeString);
	var defaultTime = new Date(defaultTimeString);
	console.log('defaultTime = '+defaultTime.toISOString());

	// Create array of Date values corresponding to GetCapabilities array of times, removing any older than our interest
	// All available times are in an array of strings, oldest first, newest last
	var allTimesString = dimension.values.split(',');	// Array of times
	console.log('allTimesString.length = '+allTimesString.length);
	var earliest = nHoursAgo(animationMaxHours);
	console.log('earliest = '+earliest.toISOString());
	allTimesArray = new Array();
	for (var i=0; i < allTimesString.length; i++) {
		var dateEntry = new Date(allTimesString[i]);	// convert from ISOString to Date object
		if (dateEntry > earliest) allTimesArray.push(dateEntry);
	}
	console.log('allTimesArray.length = '+allTimesArray.length);

	// Get bounding box
	var boundingBox = layer.BoundingBox.find( BoundingBox => { return BoundingBox.crs === 'CRS:84' } );
	if (!boundingBox) throw new Error('BoundingBox not found');

	// Get map boundaries given by RidgeII for radar site, bottom left and top right corners
	// 4326 is just the EPSG identifier of WGS84 (CRS:84).
	var bbox4326 = new Array(boundingBox.extent[0],boundingBox.extent[1],boundingBox.extent[2],boundingBox.extent[3]);
	console.log('bbox4326 = '+bbox4326.toString());
	var bbox3857 = transformExtent(bbox4326, 'EPSG:4326', 'EPSG:3857');
	console.log('bbox3857 = '+bbox3857.toString());
	var bboxString0 = bbox3857[0].toString();
	var bboxString1 = bbox3857[1].toString();
	var bboxString2 = bbox3857[2].toString();
	var bboxString3 = bbox3857[3].toString();
	// EPSG:3857 wants to get the bounding box in latitude,longitude, so rearrange
	var bboxAll=bboxString1+','+bboxString0+','+bboxString3+','+bboxString2;

	// Calculate center for map
	var latitudeCenter = (Number(bbox4326[0])+Number(bbox4326[2]))/2.0;
	var longitudeCenter = (Number(bbox4326[1])+Number(bbox4326[3]))/2.0;
	var center4326 = new Array(latitudeCenter,longitudeCenter);
	console.log('center4326 = '+center4326.toString());
	var center3857 = transform(center4326, 'EPSG:4326', 'EPSG:3857');
	console.log('center3857 = '+center3857.toString());

	// get WMS map width and height parameter values from document DOM (HTML)
	var mapElement = document.getElementById("map");
	if (!mapElement) throw new Error('map id not found in HTML');
	var radarWidth = window.getComputedStyle(mapElement, null).getPropertyValue("width");
	if (!radarWidth) throw new Error('map width not found in HTML');
	var radarHeight = window.getComputedStyle(mapElement, null).getPropertyValue("height");
	if (!radarHeight) throw new Error('map height not found in HTML');
	console.log('Width = '+radarWidth+'  Height = '+radarHeight);

	// Create or replace map marker, if required
	if (mapMarker) {
		// Create map marker icon (Reference: ol.style.Icon)
		markerIcon = new Icon({
			anchor: markerAnchor,
			anchorXUnits: markerAnchorXUnits,
			anchorYUnits: markerAnchorYUnits,
			src: markerSource
		})

		// Create style for vector layer (Reference: ol.style.Style)
		mapMarkerStyle = new Style({
			 image: markerIcon
		})

		// Create map marker point (Reference: ol.geom.Point, ol.proj.fromLonLat)
		var marker3857 = fromLonLat([markerLongitude, markerLatitude]);
		mapMarkerPoint = new Point(marker3857);

		// Create map marker feature (Reference: ol.Feature)
		mapMarkerFeature = new Feature({
			geometry: mapMarkerPoint,
 			name: markerName,
		});

		// Create source of features for vector layer (Reference: ol.source.Vector)
		mapMarkerFeatureSource = new VectorSource({
			features: [mapMarkerFeature]
		})

		// Create or update vector layer (Reference: ol.layer.Vector)
		if (!mapLayerMarker) {
			// Create mapLayerMarker
			mapLayerMarker = new VectorLayer({
				source: mapMarkerFeatureSource,
				style: mapMarkerStyle
			})
		}
		else {
			// Update mapLayerMarker
			mapLayerMarker.setSource(mapMarkerFeatureSource);
			mapLayerMarker.setStyle(mapMarkerStyle);
		}
	}

	// Use Open Street Map as first layer
	if (!mapLayerOSM) mapLayerOSM = new TileLayer({source: new OSM()});

        // Get the URL and parameters for map
	mapWmsSourceUrl = 'https://opengeo.ncep.noaa.gov/geoserver/'+radarSite+'/ows';
	mapWmsSourceParams = {
		service: 'WMS',
		version: '1.3.0',
		request: 'GetMap',
		layers: radarSiteProd,
		style: '',
		crs: 'EPSG:3857',
		bbox: bboxAll,
		format: 'image/png',
		width: radarWidth,
		height: radarHeight
	};

        // Set the source and parameters for map
	if (!mapWmsSource) {
		// Create mapWmsSource
		mapWmsSource = new ImageWMS({
			url: mapWmsSourceUrl,
			params: mapWmsSourceParams,
			serverType: 'geoserver',
			crossOrigin: 'anonymous',
		});
	}
	else {
		// Update URL and parameters for map
		mapWmsSource.setUrl(mapWmsSourceUrl);
		mapWmsSource.updateParams(mapWmsSourceParams);
	}

	// Use NOAA/NWS web map service as second layer
	if (!mapLayerWMS) {
		// Create mapLayerWMS
		mapLayerWMS = new ImageLayer({
			source: mapWmsSource,
		});
		updateInfo(defaultTime);	// Update Info display with default time
	}
	else {
		// Update mapLayerWMS - current animation index and TIME parameter for source selection
		allTimesIndex = 0;
		if (!animationId) var layerDate = defaultTime;
		else var layerDate = allTimesArray[allTimesIndex];
		mapLayerWMS.getSource().updateParams({'TIME': layerDate.toISOString()});
		updateInfo(layerDate);		// Update Info display with layer time
	}

	// Set map layers to display
	//if (!mapLayerArray) mapLayerArray = [mapLayerOSM, mapLayerWMS, mapLayerMarker];
	mapLayerArray = [mapLayerOSM, mapLayerWMS];
	if (mapMarker) mapLayerArray.push(mapLayerMarker);
	if (!mapLayerGroup) {
		// Create mapLayerGroup
		mapLayerGroup = new LayerGroup({
			layers: mapLayerArray
		});
	}
	else {
		// Update mapLayerGroup
		mapLayerCollection = new Collection(mapLayerArray);
		mapLayerGroup.setLayers(mapLayerCollection);
	}

	// Create or update map view
	if (!mapView) {
		// Create mapView
		mapView = new View({
			projection: 'EPSG:3857',
			center: center3857,
			zoom: radarZoom,
		});
	}
	else {
		// Update mapView - center and zoom
		mapView.setProperties({center: center3857,});
		mapView.setZoom(radarZoom);
	}

	// Create (display) the map
	if (!mapMap) {
		// Create mapMap
		mapMap = new Map({
			layers: mapLayerGroup,
			target: 'map',
			view: mapView,
		});
	}
	else {
		// Update mapMap
		mapMap.setLayerGroup(mapLayerGroup);
		mapMap.setView(mapView);
	}

	// Set legend
	var onlineResourceHref= layer.Style[0].LegendURL[0].OnlineResource;
	if (!onlineResourceHref) throw new Error('Legend URL not found');
	//console.log('onlineResourceHref = '+onlineResourceHref)
	document.getElementById("legend").src = onlineResourceHref;

	// Add button handlers for play and pause
	if (!controlsActive) {
		document.getElementById('play').addEventListener('click', play, false);
		document.getElementById('pause').addEventListener('click', stop, false);
		controlsActive = true;
	}

	if (!autoPlayProcessed) {
		if (autoPlay) play();
		autoPlayProcessed = true;
	}

	// Set timeout to call getCapabilities routine again
	leaveGetCapabilitiesUTC = new Date().getTime();				// Get the leave time in milliseconds
	remainingMilliseconds = (refreshMinutes * 60 * 1000) - (leaveGetCapabilitiesUTC - enterGetCapabilitiesUTC);	// Calcuate remaining time
	if (remainingMilliseconds > 0) refreshId = window.setTimeout(getCapabilities, remainingMilliseconds);
}

// Function to calculate 'one hour ago' for animation (from https://openlayers.org/en/latest/examples/wms-time.html)
function nHoursAgo(nHour) {
	return new Date(Date.now() - 3600000 * nHour);
}

// Function to advance to the next timed layer (function passed to window.setInterval below, and called at time interval) 
function advanceLayer() {
	allTimesIndex += 1;
	if (allTimesIndex >= allTimesArray.length) allTimesIndex = 0;
	var layerDate = allTimesArray[allTimesIndex];
	mapLayerWMS.getSource().updateParams({'TIME': layerDate.toISOString()});
	updateInfo(layerDate);
}

// Function to update Info display
function updateInfo(infoDate) {
	var el = document.getElementById('info');
	el.innerHTML = infoDate.toLocaleString();
}

// Function to play animation when button pressed
function play() {
	stop();
	animationId = window.setInterval(advanceLayer, 1000 / animationframeRate);
};

// Function to stop animation when button pressed
function stop() {
	if (animationId) {
		window.clearInterval(animationId);
		animationId = null;
	}
};

// Process URL parameters
processUrlParameters();

// Get capabilities for radar site WMS and process returned information.
// Completion of GetCapabilites web request drives remainder of program initialization and execution.
// GetCapabilities internally starts a timeout to refresh (by the timeout calling getCapabilities again)
getCapabilities();
