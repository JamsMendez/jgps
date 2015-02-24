# jgps

logger GPS of serial port

## Install

```bash
npm install jgps
```

## Usage

```javascript
var JGPS = require('jgps')

var gps = new JGPS( { port: '/dev/ttyO*', baudrate: 9600, ... });

gps.on('fix', function(data) {
  console.log(data);
});
```
