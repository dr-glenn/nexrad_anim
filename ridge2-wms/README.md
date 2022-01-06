Use NWS RidgeII weather radar OGC services to display maps.
This project displays a radar map in a web browser using OpenLayers (javascript).
The examples here require that you install node.js and view in a web browser.
You might be able to modify the HTML and JS to run without node.js.

BACKGROUND
RidgeII no longer supplies GIF images every 10 minutes. Instead they now create
GeoTIFF images. This is more useful, but requires more steps to create an animation
of recent weather radar. Instead I've used the GIS WMS services to generate a map.

INSTALLATION
1. Install node.js on your system. I did this in Windows 10 Pro. Easy.
2. Install additional packages to node.js:
   npm install elm-pep
   npm install parcel
   npm install ol
3. From the directory of this code, run node: "npx cross-env npm start" or just "npm start"
4. Browse to "localhost;1234"

You should now see the current CONUS (continental US) radar map.

INSTALLATION to Raspberry Pi kiosk
1. Copy the dist files to /var/www/html/
2. reboot Pi
2a. Sometimes you need to clear the Chromium cache.
    cd ~/.cache/chromium/Default
	rm -rf *
	sudo reboot
	

