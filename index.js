var serialport = require('serialport');
var events     = require('events');

var SerialPort = serialport.SerialPort;

var JGPS = (function () {

  function JGPS (options) {
    events.EventEmitter.call(this);

    this.reads = 0;
    this.collection = [];
    this.gps = {};

    if (options) {
      for(var key in options){
	     this[key] = options[key];
      }
    } else {
      this.port = '/dev/ttyO*';
      this.baudrate = 9600;
    }
    var self = this;

    this.serialPort = new SerialPort(self.port, {
      baudrate: self.baudrate,
      parser: serialport.parsers.readline('\n')
    });

    this.serialPort.on('open', function (err) {
      if (!err) {
        self.emit('open');
        self.serialPort.on('data', function(data){
          parseGPSData(data)
        });
      } else {
        self.emit('error', err);
      }
    });
  }

  function latLngToDecimal (coord) {
    if (coord == undefined) return;
    var negative = (parseInt(coord) < 0);
    var decimal = null;
    if (match = coord.match(/^-?([0-9]*?)([0-9]{2,2}\.[0-9]*)$/)) {
      deg = parseInt(match[1]);
      min = parseFloat(match[2]);
      decimal = deg + (min / 60);
      if (negative){
        decimal *= -1;
      }
    }
    return decimal;
  }

  function parseGPSData (data) {

    var line = data.split(',');

    if (line[0].slice(0,1) != "$") {
      return;
    }

    var type = line[0].slice(3,6);

    if (type == null) {
      return;
    }

    line.shift();

    switch (type) {

      case "GGA":
        this.gps.time               = line.shift();
        this.gps.latitude           = latLngToDecimal(line.shift());
        this.gps.lat_ref            = line.shift();
        this.gps.longitude          = latLngToDecimal(line.shift());
        this.gps.long_ref           = line.shift();
        this.gps.quality            = line.shift();
        this.gps.num_sat            = parseInt(line.shift());
        this.gps.hdop               = line.shift();
        this.gps.altitude           = line.shift();
        this.gps.alt_unit           = line.shift();
        this.gps.height_geoid       = line.shift();
        this.gps.height_geoid_unit  = line.shift();
        this.gps.last_dgps          = line.shift();
        this.gps.dgps               = line.shift();
      break;

      case "RMC":
        this.gps.time          = line.shift();
        this.gps.validity      = line.shift();
        this.gps.latitude      = latLngToDecimal(line.shift());
        this.gps.lat_ref       = line.shift();
        this.gps.longitude     = latLngToDecimal(line.shift());
        this.gps.long_ref      = line.shift();
        this.gps.speed         = line.shift();
        this.gps.course        = line.shift();
        this.gps.date          = line.shift();
        this.gps.variation     = line.shift();
        this.gps.var_direction = line.shift();
      break;

      case "GLL":
        this.gps.latitude    = latLngToDecimal(line.shift());
        this.gps.lat_ref     = line.shift();
        this.gps.longitude   = latLngToDecimal(line.shift());
        this.gps.long_ref    = line.shift();
        this.gps.time        = line.shift();
      break;

      case "RMA":
        line.shift();
        this.gps.latitude    = latLngToDecimal(line.shift());
        this.gps.lat_ref     = line.shift();
        this.gps.longitude   = latLngToDecimal(line.shift());
        this.gps.long_ref    = line.shift();
        line.shift();
        line.shift();
        this.gps.speed          = line.shift();
        this.gps.course         = line.shift();
        this.gps.variation      = line.shift();
        this.gps.var_direction  = line.shift();
      break;

      case "GSA":
        this.gps.mode            = line.shift();
        this.gps.mode_dimension  = line.shift();

        if(this.gps.satellites == undefined) {
          this.gps.satellites = [];
        }

        for (var i = 0; i <= 11; i++) {
          var id = line.shift();
          if (id == ''){
            this.gps.satellites[i] = {};
          } else {
            if(this.gps.satellites[i] == undefined) {
              this.gps.satellites[i] = {};
            }
            this.gps.satellites[i].id = id;
          }
        }

        this.gps.pdop = line.shift();
        this.gps.hdop = line.shift();
        this.gps.vdop = line.shift();
      break;

      case "GSV":
        this.gps.msg_count  = line.shift();
        this.gps.msg_num    = line.shift();
        this.gps.num_sat    = parseInt(line.shift());

        if(this.gps.satellites == undefined) {
          this.gps.satellites = [];
        }

        for (var i = 0; i <= 3; i++) {
          if (this.gps.satellites[i] == undefined) {
            this.gps.satellites[i] = {};
          }
          this.gps.satellites[i].elevation  = line.shift();
          this.gps.satellites[i].azimuth    = line.shift();
          this.gps.satellites[i].snr        = line.shift();
        }
      break;

      case "HDT":
        this.gps.heading  = line.shift();
      break;

      case "ZDA":
        this.gps.time  = line.shift();
        var day   = line.shift();
        var month = line.shift();
        var year  = line.shift();
        if (year.length > 2){
          year = [2, 2];
        }

        this.gps.date = day + month + year;
        this.gps.local_hour_offset    = line.shift();
        this.gps.local_minute_offset  = line.shift();
      break;
    }

    var self = this;
    Object.keys(this.gps).map(function (key) {
      var val = self.gps[key];
      if(val === ""){
        delete self.gps[key];
      }
    });

    this.reads ++;
    this.collection.push(type)
    this.collection = this.collection.filter(function(v,i,s){
      return self.onlyUnique(v,i,s);
    });

    if (this.reads > 5 && this.collection.indexOf('GGA') > -1 && this.collection.indexOf('RMC') > -1) {
      this.emit('fix', this.gps);
      this.reads = 0;
      this.collection = [];
      this.gps = {};
    }
  }

  function onlyUnique (value, index, s) {
    return s.indexOf(value) === index;
  }

  JGPS.prototype.__proto__ = events.EventEmitter.prototype;

  return JGPS;
});

module.exports = JGPS;
