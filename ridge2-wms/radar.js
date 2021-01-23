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
  url: 'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_raw/ows',
  params: {'service': 'WMS', 'version':'1.3.0', 'request':'GetMap','layers':'conus_bref_raw','style':'','crs':'EPSG:3857',
      'bbox':'20.0,-130.0,55.0,-60.0','format':'image/png','width':'600px','height':'600px'},
  serverType: 'geoserver',
  crossOrigin: 'anonymous',
});

var wmsLayer = new ImageLayer({
  source: wmsSource,
});

center4326 = [-100.0,35.0];
center3857 = transform(center4326, 'EPSG:4326', 'EPSG:3857');

var view = new View({
  projection: 'EPSG:3857',
  center: center3857,
  zoom: 4,
});

layerOSM = new TileLayer({source: new OSM()});

var map = new Map({
  layers: [layerOSM,wmsLayer],
  target: 'map',
  view: view,
});
