#!/usr/bin/env python
# coding: utf-8

# In[18]:


#get_ipython().magic(u'matplotlib inline')
import matplotlib.pyplot as plt
import tempfile
import pytz
from datetime import datetime
import pyart

templocation = tempfile.mkdtemp()
#templocation = './tmp'


# # Tutorial

# This notebook is designed to show examples using the [nexradaws](http://nexradaws.readthedocs.io/en/latest/index.html) python module.
# The first thing we need to do is instantiate an instance of the NexradAwsInterface class. This class contains methods to query and download from the Nexrad Amazon S3 Bucket.
# 
# This notebook uses Python 3.6 for it's examples.

# In[19]:


import nexradaws
conn = nexradaws.NexradAwsInterface()

ymd = ['2019','05','15']
print('Request radar records for '+str(ymd))
my_radar = 'KMUX'
print('Station = {}'.format(my_radar))
hour0 = 7
hour1 = 14
print('Hours = {} to {}'.format(hour0,hour1))

# ## Query methods
# 
# Next we will test out some of the available query methods. There are methods to get the available years, months, days, and radars.

# #### Get available years

# In[20]:


years = conn.get_avail_years()
print('Years\n'+str(years))


# #### Get available months in a year

# In[21]:

months = conn.get_avail_months(ymd[0])
print('Months\n'+str(months))


# #### Get available days in a given year and month

# In[22]:


days = conn.get_avail_days(ymd[0],ymd[1])
print('Days\n'+str(days))


# #### Get available radars in a given year, month, and day

# In[23]:


radars = conn.get_avail_radars(ymd[0],ymd[1],ymd[2])
print(radars)


# ## Query for available scans
# 
# There are two query methods to get available scans.
# * get_avail_scans() - returns all scans for a particular radar on a particular day
# * get_avail_scans_in_range() returns all scans for a particular radar between a start and end time
# 
# Both methods return a list of [AwsNexradFile](http://nexradaws.readthedocs.io/en/latest/apidocs.html#nexradaws.resources.awsnexradfile.AwsNexradFile) objects that contain metadata about the NEXRAD file on AWS. These objects can then be downloaded by passing them to the download method which we will discuss next.

# #### Get all scans for a radar on a given day

# In[24]:


availscans = conn.get_avail_scans(ymd[0],ymd[1],ymd[2], my_radar)
print("There are {} NEXRAD files available for {} for the {} radar.\n".format(len(availscans),str(ymd),my_radar))
print(availscans[0:4])


# #### Get all scans for a radar between a start and end time
# 
# Now let's get all available scans between 5-7pm CST May 31, 2013 which is during the El Reno, OK tornado. The get_avail_scans_in_range method accepts datetime objects for the start and end time. 
# 
# If the passed datetime objects are timezone aware then it will convert them to UTC before query. If they are not timezone aware it will assume the passed datetime is in UTC.

# In[25]:


pacific_timezone = pytz.timezone('US/Pacific')
radar_id = my_radar
start = pacific_timezone.localize(datetime(int(ymd[0]),int(ymd[1]),int(ymd[2]),hour0,0))
end = pacific_timezone.localize (datetime(int(ymd[0]),int(ymd[1]),int(ymd[2]),hour1,0))
scans = conn.get_avail_scans_in_range(start, end, radar_id)
print("There are {} scans available between {} and {}\n".format(len(scans), start, end))
print(scans[0:4])


# ## Downloading Files
# 
# Now let's download some radar files from our previous example. Let's download the first 4 scans from our query above.
# 
# There are two optional keyword arguments to the download method...
# 
# * keep_aws_folders - Boolean (default is False)...if True then the AWS folder structure will be replicated underneath the basepath given to the method. i.e. if basepath is /tmp and keep_aws_folders is True then the full path would be 2013/05/31/KTLX/KTLX20130531_220114_V06.gz
# 
# * threads - integer (default is 6) the number of threads to run concurrent downloads
# 

# In[26]:


results = conn.download(scans[0:4], templocation)


# The download method returns a [DownloadResult](http://nexradaws.readthedocs.io/en/latest/apidocs.html#nexradaws.resources.downloadresults.DownloadResults) object. The success attribute returns a list of [LocalNexradFile](http://nexradaws.readthedocs.io/en/latest/apidocs.html#nexradaws.resources.localnexradfile.LocalNexradFile) objects that were successfully downloaded. There is also an iter_success method that creates a generator for easily looping through the objects.

# In[27]:


print(results.success)


# In[28]:


for scan in results.iter_success():
    print ("{} volume scan time {}".format(scan.radar_id,scan.scan_time))


# You can check for any failed downloads using the failed_count attribute. You can get a list of the failed [AwsNexradFile](http://nexradaws.readthedocs.io/en/latest/apidocs.html#nexradaws.resources.awsnexradfile.AwsNexradFile) objects by calling the failed attribute. There is also a generator method called iter_failed that can be used to loop through the failed objects.

# In[29]:


print("{} downloads failed.".format(results.failed_count))


# In[30]:


print(results.failed)


# ## Working with LocalNexradFile objects
# 
# Now that we have downloaded some files let's take a look at what is available with the [LocalNexradFile](http://nexradaws.readthedocs.io/en/latest/apidocs.html#nexradaws.resources.localnexradfile.LocalNexradFile) objects.
# 
# These objects have attributes containing metadata about the local file including local filepath, last_modified (on AWS), filename, volume scan time, and radar id.
# 
# There are two methods available on the LocalNexradFile to open the local file.
# 
# * open() - returns a file object. Be sure to close the file object when done.
# 
# * open_pyart() - if pyart is installed this will return a pyart Radar object.
# 
# Let's look at an example of using pyart to open and plot our newly downloaded NEXRAD file from AWS. We will zoom into within 150km of the radar to see the storms a little better in these examples.

# In[31]:


fig = plt.figure(figsize=(16,12))
for i,scan in enumerate(results.iter_success(),start=1):
    ax = fig.add_subplot(2,2,i)
    radar = scan.open_pyart()
    display = pyart.graph.RadarDisplay(radar)
    display.plot('reflectivity',0,ax=ax,title="{} {}".format(scan.radar_id,scan.scan_time))
    display.set_limits((-150, 150), (-150, 150), ax=ax)
plt.show()

# Now lets plot velocity data for the same scans.

# In[32]:


fig = plt.figure(figsize=(16,12))
for i,scan in enumerate(results.iter_success(),start=1):
    ax = fig.add_subplot(2,2,i)
    radar = scan.open_pyart()
    display = pyart.graph.RadarDisplay(radar)
    display.plot('velocity',1,ax=ax,title="{} {}".format(scan.radar_id,scan.scan_time))
    display.set_limits((-150, 150), (-150, 150), ax=ax)
plt.show()

# In[ ]:




