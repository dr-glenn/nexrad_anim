#!/usr/bin/env python
# coding: utf-8

# This application fetches weather radar GIF images and constructs an animation.
# NOAA generates images from all US radar stations every few minutes; delta is between 3 to 6 minutes.
# The images are only guaranteed to be saved for one hour.
# Documentation of this NOAA service: https://www.weather.gov/jetstream/ridge_download
# Index of the recent files from station MUX (Mt. Umunhum, Silicon Valley radar): https://radar.weather.gov/ridge/RadarImg/N0R/MUX/
# NOAA web page for current radar displayed with overlays: https://radar.weather.gov/ridge/radar.php?rid=mux&product=N0R&overlay=11101111&loop=no
# You can also fetch NEXRAD raw data from AWS servers. This data goes back to 1992!
# NEXRAD RAW needs to be processed to generate images. In Python I have found that it takes tens of seconds
# to fetch the data and process it into images on my desktop system: this will never work on a Raspberry Pi.

# Runs in Python 2.7. If you run in 3.6, it will import different packages.

GIF_FORMAT='GIF-PIL'    # You must install Pillow, not PIL for Python 2.7
#GIF_FORMAT='GIF-FI'    # FreeImage does not write correct anim GIF in Python 2.7
RADAR_STATION='MUX'     # Mt. Umunhum, Los Gatos, CA
ANIM_FILE_OUT='radar_anim.gif'

import os
import numpy as np
import datetime as dt
import requests
#from BeautifulSoup import BeautifulSoup as bs
import imageio
# Run once only if you use 'GIF-FI' (does not generate correct anim-gif with Python 2.7)
# NOTE: better to do it from cmd shell
#imageio.plugins.freeimage.download()

try:    # Python 2.7
    from urllib2 import urlopen,Request
except: # Python 3.x
    from urllib.request import urlopen,Request

try:    # Python 2.7
    from HTMLParser import HTMLParser
except: # Python 3.x
    from html.parser import HTMLParser

# to use HTMLParser I need to implement my own class?
class MyHTMLParser(HTMLParser):
    def __init__(self,station):
        '''
        :param station: radar station name, e.g., "mux" for Mt. Umunhum
        '''
        #super(MyHTMLParser,self).__init__()   # new style super
        HTMLParser.__init__(self)    # old style super does not inherit from object
        self.images = []
        self.station = station
        
    def handle_starttag(self, tag, attrs):
        '''
        Look for HTML tag with specific attributes.
        You have to look at the radar.weather.gov pages to know how to parse.
        :param tag: tag type. This application only looks at 'a' tags
        :param attrs: attributes of the tag. This app only looks for 'href' with 'station' name.
        '''
        if tag == 'a':
            for attr in attrs:
                if attr[0] == 'href':
                    if attr[1].startswith(self.station):
                        # attr[1] is the tail of the URL that specifies the GIF image.
                        self.images.append(attr[1])

    def handle_endtag(self, tag):
        #rint "End tag  :", tag
        pass

    def handle_data(self, data):
        #rint "Data     :", data
        pass
        
    def get_img_list(self):
        '''
        After HTML parsing is done, we have a list of radar images for the station.
        :return: list of GIF files from NWS.
        '''
        return self.images

class RadarAnimator:
    global GIF_FORMAT
    img_root_url = 'https://radar.weather.gov/ridge/RadarImg/N0R/'
    def __init__(self, station, twindow=70):
        self.station = station.upper()
        self.img_dir_url = self.img_root_url + self.station.upper()
        self.twindow = twindow
        self.start_time = -1
        self.end_time = -1
        self.img_tuples = []
        self.gif_format = GIF_FORMAT
        
    def fetch_gifs(self):
        img_tuples = self.get_img_tuples()
        self.calc_time_bounds(img_tuples)
        self.img_tuples = self.filter_img_tuples(img_tuples)
        img_gifs = self.fetch_img_gifs(self.img_tuples) # fetches GIFs as a list of numpy arrays
        return img_gifs
            
    def img_name_tuple(self, imgfile):
        '''
        Convert GIF image name to tuple with (datetime,str(datetime),image_name)
        :param imgfile: a filename from NWS radar.
        '''
        img_parse = imgfile.split('_')
        station = img_parse[0]
        img_date = img_parse[1]
        img_time = img_parse[2]
        #print img_date,img_time
        year = int(img_date[0:4])
        month = int(img_date[4:6])
        day = int(img_date[6:8])
        hour = int(img_time[0:2])
        minute = int(img_time[2:4])
        # TODO: what about timezone?
        dtobj = dt.datetime(year,month,day,hour,minute)
        dtstr = dtobj.strftime('%Y-%m-%d %H:%M')
        return (dtobj,dtstr,imgfile)

    def fetch_img_gifs(self, image_list):
        # read from URL and store images
        ims_gif = []
        if True:    # use imageio to read
            for f in image_list:
                url = self.img_dir_url + '/' + f[2]
                print('fetch: '+url)
                # reading from HTTP stream does not allow seek (which Pillow uses)
                img = imageio.imread(imageio.core.urlopen(url).read(), format=self.gif_format)   # it's a numpy array
                ims_gif.append(img)     
        else:   # use Request and Image classes
            for f in image_list:
                url = self.img_dir_url + '/' + f[2]
                print(url)
                request = Request(url)
                pic = urlopen(request)
                pil_im = Image.open(pic)
                if True:
                    new_im = Image.new("RGBA", pil_im.size)
                    new_im.paste(pil_im)
                    ims_gif.append(new_im)
                else:
                    ims_gif.append(pil_im)
        return ims_gif

    def calc_time_bounds(self, img_tuples):
        '''
        :param img_tuples: list of image names from NWS.
        :param twindow: time window in minutes. They only guarantee one hour of history.
        :return: tuple of start and end times
        '''
        tdelta = dt.timedelta(minutes=self.twindow)
        self.end_time = img_tuples[-1][0]  # the time of most recent image
        self.start_time = self.end_time - tdelta
        return (self.start_time, self.end_time)

    def get_time_bounds(self):
        '''
        :param img_tuples: list of image names from NWS.
        :param twindow: time window in minutes. They only guarantee one hour of history.
        :return: tuple of start and end times
        '''
        return (self.start_time, self.end_time)
        
    def get_nws_img_list(self):
        '''
        Fetch current GIF list from NOAA RIDGE system.
        Images are 600x550 8 bit GIF.
        Generally we get 1 to three hours, images every 10 minutes.
        :param station: radar station name from NWS.
        :return: list of GIF filenames available.
        '''
        hparse = MyHTMLParser(self.station) 
        r = requests.get(self.img_dir_url)
        hparse.feed(r.text)
        img_list = hparse.get_img_list()
        return img_list
        
    def make_img_tuples(self, img_list):
        img_tuples = []
        # Generate list of all images returned by HTML. It may go back a few hours.
        for img in img_list:
            img_tup = self.img_name_tuple(img)
            #print(img_tup[1])
            img_tuples.append(img_tup)
        return img_tuples
    
    def get_img_tuples(self):
        # Fetch current GIF list from NOAA RIDGE system
        # Images are 600x550 8 bit GIF
        img_list = self.get_nws_img_list()

        # List of images is sorted with most recent at end
        print('Found images: %d' %(len(img_list)))
        print(str(img_list))
        
        img_tuples = self.make_img_tuples(img_list)
        return img_tuples
        
    def filter_img_tuples(self, img_tuples):
        imgs = [a for a in img_tuples if a[0] >= self.start_time and a[0] <= self.end_time]
        return imgs
        
    def create_anim_gif(self, anim_out, img_gifs):
        '''
        :param img_dir_url: NWS for the radar GIFs
        :param img_tuples: list of tuples that specify the GIF filenames.
        :param anim_out: either a GIF filename or imageio.RETURN_BYTES.
        :return: None (if writing file) or byte array
        '''
        #print("createAnimGIF: images=%d" %len(img_tuples))
        return imageio.mimwrite(anim_out, img_gifs, loop=0, duration=0.5, format=self.gif_format)

    def get_img_dir_url(self):
        return self.img_dir_url
    
def main2(station=RADAR_STATION, gif_out=ANIM_FILE_OUT):
    print('fetch station=%s'%(station))
    rad_anim = RadarAnimator(station)
    img_dir_url = rad_anim.get_img_dir_url()
    img_gifs = rad_anim.fetch_gifs()
    start_time,end_time = rad_anim.get_time_bounds()
    print('end_time = %s, start = %s' %(end_time.strftime('%Y-%m-%d %H:%M'),start_time.strftime('%Y-%m-%d %H:%M')))
    return rad_anim.create_anim_gif(gif_out, img_gifs)

if __name__== "__main__":
    import sys
    import getopt
    cmdArgs = sys.argv
    print('argv: '+str(cmdArgs))
    argsList = cmdArgs[1:]  # '0' is the program name itself
    shortOpts = 'hs:o:'
    longOpts  = ['help', 'station=', 'out=']
    try:
        args,values = getopt.getopt(argsList, shortOpts, longOpts)
    except getopt.error as err:
        print('ERROR unknown arg: '+str(err))
        sys.exit(2)
    station = RADAR_STATION
    for arg,val in args:
        print('arg=%s, value=%s' %(arg,val))
        if arg in ('-s','--station'):
            station = val
        
    main2(station=station)
    