# -*- coding: utf-8 -*-

# Form implementation generated from reading ui file 'rad_disp_ex.ui'
#
# Created by: PyQt5 UI code generator 5.9.2
#
# WARNING! All changes made in this file will be lost!

from PyQt5 import QtCore, QtGui, QtWidgets
import radar   
import imageio         
RADAR_SCALE = True  # if radar GIF needs to be scaled to fit in display window

# scaling of QMovie can be dynamically accomplished: https://stackoverflow.com/questions/50162090/pyqt-resize-qmovie-with-proper-anti-aliasing
# def resizeEvent(self,event) in order to resize if user changes window.

class Ui_MainWindow(object):
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
        self.textBrowser = QtWidgets.QTextBrowser(self.centralwidget)
        self.textBrowser.setGeometry(QtCore.QRect(330, 100, 231, 192))
        self.textBrowser.setObjectName("textBrowser")
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
        if True:
            # Using a byte buffer for GIF
            self.giffy = radar.main(station=station, gif_out=imageio.RETURN_BYTES)
            print('giffy=%d' %(len(self.giffy)))
            self.byteArray = QtCore.QByteArray(self.giffy)
            self.gif_bytes = QtCore.QBuffer(self.byteArray) # parent class is QIODevice
            # oh my, the second arg has to be bytes, but it is just the format name!
            # https://stackoverflow.com/questions/51832829/qmovie-unexpected-argument-qbuffer
            self.mov = QtGui.QMovie(self.gif_bytes, b"gif")
        else:
            # Using a file for GIF
            radar.main(station=station, gif_out=radar.ANIM_FILE_OUT)
            self.mov = QtGui.QMovie(radar.ANIM_FILE_OUT)
            #self.mov.setCacheMode(QtGui.QMovie.CacheAll)
        self.radarMovie.setMovie(self.mov)
        if RADAR_SCALE:
            rect = self.radarMovie.geometry()
            size = QtCore.QSize(min(rect.width(),rect.height()), min(rect.width(),rect.height()))
            movie = self.radarMovie.movie() # retrieve the QMovie object
            movie.setScaledSize(size)
        self.mov.start()

if __name__ == "__main__":
    import sys
    app = QtWidgets.QApplication(sys.argv)
    MainWindow = QtWidgets.QMainWindow()
    ui = Ui_MainWindow()
    ui.setupUi(MainWindow)
    MainWindow.show()
    sys.exit(app.exec_())

