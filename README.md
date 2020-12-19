Purpose: display Nexrad radar images in animated time loop.
I want to replicate the weather radar displays commonly found on weather websites.

Nexrad data is now free to all from AWS servers.
This work will be based on https://nexradaws.readthedocs.io/en/latest/Tutorial.html#Query-methods

I am using Python 3.x from Anaconda on Windows 10.

nws_radar_gif - fetches radar images from the last hour and creates animated GIF. This program
is intended to be run from command line. It might be run as a cron job every 10 minutes in order
to keep the images up to date. The program runs without threads and can hang if the NWS web
does not return GIF images. You will use the generated animated GIF in either a desktop app
or in a web page.

rad_disp4 - this program is a desktop GUI app written with PyQt5. It uses qtradar.py.
With PyQt the program runs a GUI thread to update the images periodically. Also when fetching
the GIF images from NWS, the process runs a state machine so that it never stalls on a slow
or blocked download. But consider this program as a demonsration and not as a useful program.
I believe it's better to run nws_radar_gif from a cron job.

There are some early experiments in Jupyter notebooks - ipynb files.
Other python programs here are experiments.
