Purpose: display Nexrad radar images in animated time loop.
I want to replicate the weather radar displays commonly found on weather websites.

Nexrad data is now free to all from AWS servers.
This work will be based on https://nexradaws.readthedocs.io/en/latest/Tutorial.html#Query-methods

I am using Python 2.7 from Anaconda on Windows 10.
I created a virtual env. Had to install pyart (https://github.com/ARM-DOE/pyart/wiki/Simple-Install-of-Py-ART-using-Anaconda).
This resulted in a number of package demotions: I saw a lower version of numpy and PyQt5 demoted to PQt4.
Then I had to install nexradaws: used pip for this.
