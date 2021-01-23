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
import {transformExtent} from 'ol/proj';

console.log('start radar_kmux');
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

var wmsLayer = new ImageLayer({
  source: wmsSource,
});

center4326 = [-121.9,37.15];
center3857 = transform(center4326, 'EPSG:4326', 'EPSG:3857');

var view = new View({
  projection: 'EPSG:3857',
  center: center3857,
  zoom: 8,
});

layerOSM = new TileLayer({source: new OSM()});

var map = new Map({
  layers: [layerOSM,wmsLayer],
  target: 'map',
  view: view,
});

map.on('singleclick', function (evt) {
  document.getElementById('info').innerHTML = '';
  var viewResolution = /** @type {number} */ (view.getResolution());
  var url = wmsSource.getFeatureInfoUrl(
    evt.coordinate,
    viewResolution,
    'EPSG:3857',
    {'INFO_FORMAT': 'text/html'}
  );
  if (url) {
    fetch(url)
      .then(function (response) { return response.text(); })
      .then(function (html) {
        document.getElementById('info').innerHTML = html;
      });
  }
});

map.on('pointermove', function (evt) {
  if (evt.dragging) {
    return;
  }
  var pixel = map.getEventPixel(evt.originalEvent);
  var hit = map.forEachLayerAtPixel(pixel, function () {
    return true;
  });
  map.getTargetElement().style.cursor = hit ? 'pointer' : '';
});
