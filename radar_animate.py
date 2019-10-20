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

# In[1]:

PY3=False
GIF_FORMAT='GIF-PIL'

#get_ipython().magic(u'matplotlib notebook')
import os
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np
import datetime as dt
import imageio
#imageio.plugins.freeimage.download()
if PY3:
    from urllib.request import urlopen,Request
else:
    from urllib2 import urlopen,Request


# In[2]:


# Fetch current GIF list from NOAA RIDGE system
# Images are 600x550 8 bit GIF
rad_station = 'mux'
img_root_url = 'https://radar.weather.gov/ridge/RadarImg/N0R/'
img_dir_url = img_root_url + rad_station.upper()

import requests
#from BeautifulSoup import BeautifulSoup as bs
if PY3:
    from html.parser import HTMLParser
else:
    from HTMLParser import HTMLParser
r = requests.get(img_dir_url)
#r.text


# In[3]:
def createAnimGIF(images):
    '''
    :param images: list of PIL.Image objects
    '''
    print("createAnimGIF: images=%d" %len(images))
    im = images[0]
    #im.save('out.gif', save_all=True, append_images=images[1:], optimize=False, duration=500, loop=0)
    imageio.mimwrite('imageio.gif', images, loop=0, duration=0.5, format=GIF_FORMAT)


# to use HTMLParser I need to implement my own class?
class MyHTMLParser(HTMLParser):
    def __init__(self,station):
        #super(MyHTMLParser,self).__init__()   # new style super
        HTMLParser.__init__(self)    # old style super does not inherit from object
        self.images = []
        self.station = station
        
    def handle_starttag(self, tag, attrs):
        '''
        print("Start tag:", tag)
        for attr in attrs:
            print( "     attr:", attr)
        '''
        if tag == 'a':
            for attr in attrs:
                if attr[0] == 'href':
                    if attr[1].startswith(self.station):
                        self.images.append(attr[1])

    def handle_endtag(self, tag):
        #rint "End tag  :", tag
        pass

    def handle_data(self, data):
        #rint "Data     :", data
        pass

hparse = MyHTMLParser('MUX')
hparse.feed(r.text)


# In[4]:


# List of images is sorted with most recent at end
print('Found images: %d' %(len(hparse.images)))
print( str(hparse.images))


# In[5]:


# Use only last hour of images
# Convert entire list to tuples with (datetime,str(datetime),image_name)

def img_name_tuple(imgfile):
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

twindow = 70   # minutes of history
tdelta = dt.timedelta(minutes=twindow)
imgs = []
for img in hparse.images:
    img_tup = img_name_tuple(img)
    #print(img_tup[1])
    imgs.append(img_tup)
end_time = imgs[-1][0]
start_time = end_time - tdelta
print('end_time = %s, start = %s' %(end_time.strftime('%Y-%m-%d %H:%M'),start_time.strftime('%Y-%m-%d %H:%M')))


# In[6]:


imgs1 = [a for a in imgs if a[0] >= start_time and a[0] <= end_time]
fig,ax = plt.subplots()
ax.patch.set_facecolor('black')
from PIL import Image

# matplotlib animate in window
if False:
    ims = []
    for f in imgs1:
        url = img_dir_url + '/' + f[2]
        print(url)
        request = Request(url)
        pic = urlopen(request)
        pil_im = Image.open(pic)
        new_im = Image.new("RGBA", pil_im.size)
        new_im.paste(pil_im)
        im = ax.imshow(new_im)
        ims.append([im])

    ani = animation.ArtistAnimation(fig, ims, interval=250, blit=True,
                                    repeat_delay=1000)
    #ani.save('dynamic_images.mp4')

    plt.show()

def getImages(image_list):
    # read from URL and store images
    global img_dir_url, GIF_FORMAT
    ims_gif = []
    if True:    # use imageio to read
        for f in image_list:
            url = img_dir_url + '/' + f[2]
            print('fetch: '+url)
            if True:
                # reading from HTTP stream does not allow seek (which Pillow uses)
                img = imageio.imread(imageio.core.urlopen(url).read(), format=GIF_FORMAT)   # it's a numpy array
            else:   # this will attempt to 'seek'
                img = imageio.imread(url, format=GIF_FORMAT)   # it's a numpy array
            ims_gif.append(img)     
        createAnimGIF(ims_gif)
    else:   # use Request and Image classes
        for f in image_list:
            url = img_dir_url + '/' + f[2]
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
        createAnimGIF(ims_gif)

getImages(imgs1)
# In[ ]:




