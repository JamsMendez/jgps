var serialport = require('serialport');
var events     = require('events');

var SerialPort = serialport.SerialPort;

var JGPS = (function () {

  var reads = 0;
  var collection = [];
  var gps = {};

  function JGPS (options) {

    events.EventEmitter.call(this);

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
          gps.time               = line.shift();
          gps.latitude           = latLngToDecimal(line.shift());
          gps.lat_ref            = line.shift();
          gps.longitude          = latLngToDecimal(line.shift());
          gps.long_ref           = line.shift();
          gps.quality            = line.shift();
          gps.num_sat            = parseInt(line.shift());
          gps.hdop               = line.shift();
          gps.altitude           = line.shift();
          gps.alt_unit           = line.shift();
          gps.height_geoid       = line.shift();
          gps.height_geoid_unit  = line.shift();
          gps.last_dgps          = line.shift();
          gps.dgps               = line.shift();
        break;

        case "RMC":
          gps.time          = line.shift();
          gps.validity      = line.shift();
          gps.latitude      = latLngToDecimal(line.shift());
          gps.lat_ref       = line.shift();
          gps.longitude     = latLngToDecimal(line.shift());
          gps.long_ref      = line.shift();
          gps.speed         = line.shift();
          gps.course        = line.shift();
          gps.date          = line.shift();
          gps.variation     = line.shift();
          gps.var_direction = line.shift();
        break;

        case "GLL":
          gps.latitude    = latLngToDecimal(line.shift());
          gps.lat_ref     = line.shift();
          gps.longitude   = latLngToDecimal(line.shift());
          gps.long_ref    = line.shift();
          gps.time        = line.shift();
        break;

        case "RMA":
          line.shift();
          gps.latitude    = latLngToDecimal(line.shift());
          gps.lat_ref     = line.shift();
          gps.longitude   = latLngToDecimal(line.shift());
          gps.long_ref    = line.shift();
          line.shift();
          line.shift();
          gps.speed          = line.shift();
          gps.course         = line.shift();
          gps.variation      = line.shift();
          gps.var_direction  = line.shift();
        break;

        case "GSA":
          gps.mode            = line.shift();
          gps.mode_dimension  = line.shift();

          if(gps.satellites == undefined) {
            gps.satellites = [];
          }

          for (var i = 0; i <= 11; i++) {
            var id = line.shift();
            if (id == ''){
              gps.satellites[i] = {};
            } else {
              if(gps.satellites[i] == undefined) {
                gps.satellites[i] = {};
              }
              gps.satellites[i].id = id;
            }
          }

          gps.pdop = line.shift();
          gps.hdop = line.shift();
          gps.vdop = line.shift();
        break;

        case "GSV":
          gps.msg_count  = line.shift();
          gps.msg_num    = line.shift();
          gps.num_sat    = parseInt(line.shift());

          if(gps.satellites == undefined) {
            gps.satellites = [];
          }

          for (var i = 0; i <= 3; i++) {
            if (gps.satellites[i] == undefined) {
              gps.satellites[i] = {};
            }
            gps.satellites[i].elevation  = line.shift();
            gps.satellites[i].azimuth    = line.shift();
            gps.satellites[i].snr        = line.shift();
          }
        break;

        case "HDT":
          gps.heading  = line.shift();
        break;

        case "ZDA":
          gps.time  = line.shift();
          var day   = line.shift();
          var month = line.shift();
          var year  = line.shift();
          if (year.length > 2){
            year = [2, 2];
          }

          gps.date = day + month + year;
          gps.local_hour_offset    = line.shift();
          gps.local_minute_offset  = line.shift();
        break;
      }

      var self = this;
      Object.keys(this.gps).map(function (key) {
        var val = self.gps[key];
        if(val === ""){
          delete self.gps[key];
        }
      });

      reads ++;
      collection.push(type)
      collection = collection.filter(function(v,i,s){
        return self.onlyUnique(v,i,s);
      });

      if (reads > 5 && this.collection.indexOf('GGA') > -1 && collection.indexOf('RMC') > -1) {
        this.emit('fix', this.gps);
        reads = 0;
        collection = [];
        gps = {};
      }
    }

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

  function onlyUnique (value, index, s) {
    return s.indexOf(value) === index;
  }

  return JGPS;

})();

JGPS.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = JGPS;
