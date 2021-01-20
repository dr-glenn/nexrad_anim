# -*- coding: utf-8 -*-

# Form implementation generated from reading ui file 'rad_disp_ex.ui'
#
# Created by: PyQt5 UI code generator 5.9.2
#
# WARNING! All changes made in this file will be lost!

from PyQt5 import QtCore, QtGui, QtWidgets
import signal
import qtradar as radar
import imageio
import datetime as dt
RADAR_SCALE = True  # if radar GIF needs to be scaled to fit in display window

# scaling of QMovie can be dynamically accomplished: https://stackoverflow.com/questions/50162090/pyqt-resize-qmovie-with-proper-anti-aliasing
# def resizeEvent(self,event) in order to resize if user changes window.

class Ui_MainWindow(object):
    def __init__(self):
        self.start_radar = False
        
    def setupUi(self, MainWindow):
        MainWindow.setObjectName("MainWindow")
        MainWindow.resize(800, 600)
        self.centralwidget = QtWidgets.QWidget(MainWindow)
        self.centralwidget.setObjectName("centralwidget")
        '''
        self.radarFrame = QtWidgets.QFrame(self.centralwidget)
        self.radarFrame.setGeometry(QtCore.QRect(30, 60, 275, 300))
        self.radarFrame.setFrameShape(QtWidgets.QFrame.Box)
        self.radarFrame.setFrameShadow(QtWidgets.QFrame.Raised)
        self.radarFrame.setLineWidth(2)
        self.radarFrame.setObjectName("radarFrame")
        '''
        self.radarMovie = QtWidgets.QLabel(self.centralwidget)
        self.radarMovie.setGeometry(QtCore.QRect(30, 60, 275, 300))
        #self.radarMovie.setFrameShape(QtWidgets.QFrame.Box)
        #self.radarMovie.setFrameShadow(QtWidgets.QFrame.Raised)
        self.radarMovie.setLineWidth(2)
        self.radarMovie.setObjectName("radarMovie")

        self.stationInput = QtWidgets.QLineEdit(self.centralwidget)
        self.stationInput.setGeometry(QtCore.QRect(400, 20, 113, 20))
        self.stationInput.setObjectName("stationInput")
        self.stationInput.setText("mux")
        self.label = QtWidgets.QLabel(self.centralwidget)
        self.label.setGeometry(QtCore.QRect(360, 20, 47, 13))
        self.label.setObjectName("label")
        self.okButton = QtWidgets.QPushButton(self.centralwidget)
        self.okButton.setGeometry(QtCore.QRect(400, 50, 75, 23))
        self.okButton.setObjectName("okButton")
        self.radarTitle = QtWidgets.QLabel(self.centralwidget)
        self.radarTitle.setGeometry(QtCore.QRect(30, 20, 275, 20))
        self.radarTitle.setFrameShape(QtWidgets.QFrame.Box)
        self.radarTitle.setLineWidth(2)
        self.radarTitle.setObjectName("radarTitle")

        self.textBox = QtWidgets.QTextEdit(self.centralwidget)
        self.textBox.setGeometry(QtCore.QRect(330, 100, 231, 192))
        self.textBox.setObjectName("textBrowser")
        self.textBox.setFrameShape(QtWidgets.QFrame.Box)
        self.textBox.setLineWidth(2)
        '''
        # add a QScrollArea to QLabel
        self.textBox = QtWidgets.QLabel(self.centralwidget)
        self.textBox.setGeometry(QtCore.QRect(330, 100, 231, 192))
        self.textBox.setObjectName("textBox")
        self.textBox.setFrameShape(QtWidgets.QFrame.Box)
        self.textBox.setLineWidth(2)
        if False:
            self.scrollArea = QtWidgets.QScrollArea()
            self.scrollArea.setBackgroundRole(QtGui.QPalette.Dark)
            self.scrollArea.setWidget(self.textBox)
        '''

        MainWindow.setCentralWidget(self.centralwidget)
        self.menubar = QtWidgets.QMenuBar(MainWindow)
        self.menubar.setGeometry(QtCore.QRect(0, 0, 800, 21))
        self.menubar.setObjectName("menubar")
        MainWindow.setMenuBar(self.menubar)
        self.statusbar = QtWidgets.QStatusBar(MainWindow)
        self.statusbar.setObjectName("statusbar")
        MainWindow.setStatusBar(self.statusbar)

        self.retranslateUi(MainWindow)
        self.okButton.pressed.connect(self.okClicked)
        QtCore.QMetaObject.connectSlotsByName(MainWindow)

    def retranslateUi(self, MainWindow):
        _translate = QtCore.QCoreApplication.translate
        MainWindow.setWindowTitle(_translate("MainWindow", "MainWindow"))
        self.label.setText(_translate("MainWindow", "Station"))
        self.okButton.setText(_translate("MainWindow", "Ok"))
        self.radarTitle.setText(_translate("MainWindow", "radar display title"))
        self.radarMovie.setText("movie shows here")
        
    def okClicked(self):
        self.radarTitle.setText('button pressed')
        # read the station name
        station = self.stationInput.text()
        self.radarTitle.setText('station=%s' %(station))
        # call the radar fetcher
        # generate animnated GIF
        # stuff it into QMovie
        # using QByteArray to init QMovie: https://stackoverflow.com/questions/30895402/loading-animated-gif-data-in-qmovie
        # Using a byte buffer for GIF
        self.radar = radar.RadarAnimator(station=station)
        self.start_radar = True
        '''
        print('giffy=%d' %(len(self.giffy)))
        self.byteArray = QtCore.QByteArray(self.giffy)
        self.gif_bytes = QtCore.QBuffer(self.byteArray) # parent class is QIODevice
        # oh my, the second arg has to be bytes, but it is just the format name!
        # https://stackoverflow.com/questions/51832829/qmovie-unexpected-argument-qbuffer
        self.mov = QtGui.QMovie(self.gif_bytes, b"gif")
        self.radarMovie.setMovie(self.mov)
        if RADAR_SCALE:
            rect = self.radarMovie.geometry()
            size = QtCore.QSize(min(rect.width(),rect.height()), min(rect.width(),rect.height()))
            movie = self.radarMovie.movie() # retrieve the QMovie object
            movie.setScaledSize(size)
        self.mov.start()
        '''
    def closeEvent(self,event):
        myquit()
        
def tick():
    global ui
    #print('tick')
    if ui.start_radar:
        ui.textBox.append("Generate new movie")
        mov = ui.radar.generate_movie()   # call the state machine
        if mov:
            # TODO: all below here should be part of Ui_MainWindow class
            ui.radarMovie.setMovie(mov)
            if RADAR_SCALE:
                rect = ui.radarMovie.geometry()
                size = QtCore.QSize(min(rect.width(),rect.height()), min(rect.width(),rect.height()))
                movie = ui.radarMovie.movie() # retrieve the QMovie object
                movie.setScaledSize(size)
            mov.start()
        if mov:
            ui.start_radar = False

def tick1m():
    global ui
    global program_min_count, prog_dt
    program_min_count += 1
    prog_dt = dt.datetime.now()
    #ui.textBox.setText('minute = %d' %(program_min_count))
    ui.textBox.append('date = %s' %str(prog_dt))

def tick10m():
    global ui
    ui.radar.stop()

    ui.start_radar = True   # force it to reload from NOAA
    
def qtstart():
    print('qtstart:')
    
def myquit():
    global ctimer
    print('bye bye')
    ctimer.stop()
    ui.radar.stop()
    QtCore.QTimer.singleShot(30, realquit)

def realquit():
    if True:
        # causes crash in Windows
        QtGui.QApplication.exit(0)
    else:
        # but this leaves some threads hanging
        exit()

if __name__ == "__main__":
    import sys
    global ui
    global program_min_count
    global prog_dt
    program_min_count = 0
    prog_dt = dt.datetime.now()
    app = QtWidgets.QApplication(sys.argv)
    MainWindow = QtWidgets.QMainWindow()
    ui = Ui_MainWindow()
    ui.setupUi(MainWindow)
    ui.textBox.setText('date = %s' %str(prog_dt))

    stimer = QtCore.QTimer()
    stimer.singleShot(10, qtstart)
    
    # Clock timer. Whenever the timer runs out, call 'tick' function
    ctimer = QtCore.QTimer()
    ctimer.timeout.connect(tick)
    ctimer.start(1000)  # 1000 ms
    
    ctimer1m = QtCore.QTimer()
    ctimer1m.timeout.connect(tick1m)
    ctimer1m.start(60*1000)  # 1000 ms
    
    ctimer10m = QtCore.QTimer()
    ctimer10m.timeout.connect(tick10m)
    ctimer10m.start(60*10*1000)  # 1000 ms

    signal.signal(signal.SIGINT, myquit)
    
    MainWindow.show()
    sys.exit(app.exec_())

