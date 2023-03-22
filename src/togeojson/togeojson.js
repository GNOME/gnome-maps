import * as Dom from '../xmldom/dom.js';

export var toGeoJSON = (function() {
    'use strict';

    var removeSpace = /\s*/g,
        trimSpace = /^\s*|\s*$/g,
        splitSpace = /\s+/;
    // generate a short, numeric hash of a string
    function okhash(x) {
        if (!x || !x.length) return 0;
        for (var i = 0, h = 0; i < x.length; i++) {
            h = ((h << 5) - h) + x.charCodeAt(i) | 0;
        } return h;
    }
    // all Y children of X
    function get(x, y) { return x.getElementsByTagName(y); }
    function attr(x, y) { return x.getAttribute(y); }
    function attrf(x, y) { return parseFloat(attr(x, y)); }
    // one Y child of X, if any, otherwise null
    function get1(x, y) { var n = get(x, y); return n.length ? n[0] : null; }
    // https://developer.mozilla.org/en-US/docs/Web/API/Node.normalize
    function norm(el) { if (el.normalize) { el.normalize(); } return el; }
    // cast array x into numbers
    function numarray(x) {
        for (var j = 0, o = []; j < x.length; j++) { o[j] = parseFloat(x[j]); }
        return o;
    }
    function clean(x) {
        var o = {};
        for (var i in x) { if (x[i]) { o[i] = x[i]; } }
        return o;
    }
    // get the content of a text node, if any
    function nodeVal(x) {
        if (x) { norm(x); }
        return (x && x.textContent) || '';
    }
    // get one coordinate from a coordinate array, if any
    function coord1(v) { return numarray(v.replace(removeSpace, '').split(',')); }
    // get all coordinates from a coordinate array as [[],[]]
    function coord(v) {
        var coords = v.replace(trimSpace, '').split(splitSpace),
            o = [];
        for (var i = 0; i < coords.length; i++) {
            o.push(coord1(coords[i]));
        }
        return o;
    }
    function coordPair(x) {
        var ll = [attrf(x, 'lon'), attrf(x, 'lat')],
            ele = get1(x, 'ele'),
            // handle namespaced attribute in browser
            heartRate = get1(x, 'gpxtpx:hr') || get1(x, 'hr'),
            time = get1(x, 'time'),
            e;
        if (ele) {
            e = parseFloat(nodeVal(ele));
            if (!isNaN(e)) {
                ll.push(e);
            }
        }
        return {
            coordinates: ll,
            time: time ? nodeVal(time) : null,
            heartRate: heartRate ? parseFloat(nodeVal(heartRate)) : null
        };
    }

    // create a new feature collection parent object
    function fc() {
        return {
            type: 'FeatureCollection',
            features: []
        };
    }

    var serializer = new Dom.XMLSerializer();
    function xml2str(str) {
        // IE9 will create a new XMLSerializer but it'll crash immediately.
        // This line is ignored because we don't run coverage tests in IE9
        /* istanbul ignore next */
        if (str.xml !== undefined) return str.xml;
        return serializer.serializeToString(str);
    }

    var t = {
        kml: function(doc) {

            var gj = fc(),
                // styleindex keeps track of hashed styles in order to match features
                styleIndex = {},
                // atomic geospatial types supported by KML - MultiGeometry is
                // handled separately
                geotypes = ['Polygon', 'LineString', 'Point', 'Track', 'gx:Track'],
                // all root placemarks in the file
                placemarks = get(doc, 'Placemark'),
                styles = get(doc, 'Style'),
                styleMaps = get(doc, 'StyleMap');

            for (var k = 0; k < styles.length; k++) {
                styleIndex['#' + attr(styles[k], 'id')] = okhash(xml2str(styles[k])).toString(16);
            }
            for (var l = 0; l < styleMaps.length; l++) {
                styleIndex['#' + attr(styleMaps[l], 'id')] = okhash(xml2str(styleMaps[l])).toString(16);
            }
            for (var j = 0; j < placemarks.length; j++) {
                gj.features = gj.features.concat(getPlacemark(placemarks[j]));
            }
            function kmlColor(v) {
                var color, opacity;
                v = v || '';
                if (v.substr(0, 1) === '#') { v = v.substr(1); }
                if (v.length === 6 || v.length === 3) { color = v; }
                if (v.length === 8) {
                    opacity = parseInt(v.substr(0, 2), 16) / 255;
                    color = '#'+v.substr(2);
                }
                return [color, isNaN(opacity) ? undefined : opacity];
            }
            function gxCoord(v) { return numarray(v.split(' ')); }
            function gxCoords(root) {
                var elems = get(root, 'coord', 'gx'), coords = [], times = [];
                if (elems.length === 0) elems = get(root, 'gx:coord');
                for (var i = 0; i < elems.length; i++) coords.push(gxCoord(nodeVal(elems[i])));
                var timeElems = get(root, 'when');
                for (var j = 0; j < timeElems.length; j++) times.push(nodeVal(timeElems[j]));
                return {
                    coords: coords,
                    times: times
                };
            }
            function getGeometry(root) {
                var geomNode, geomNodes, i, j, k, geoms = [], coordTimes = [];
                if (get1(root, 'MultiGeometry')) { return getGeometry(get1(root, 'MultiGeometry')); }
                if (get1(root, 'MultiTrack')) { return getGeometry(get1(root, 'MultiTrack')); }
                if (get1(root, 'gx:MultiTrack')) { return getGeometry(get1(root, 'gx:MultiTrack')); }
                for (i = 0; i < geotypes.length; i++) {
                    geomNodes = get(root, geotypes[i]);
                    if (geomNodes) {
                        for (j = 0; j < geomNodes.length; j++) {
                            geomNode = geomNodes[j];
                            if (geotypes[i] === 'Point') {
                                geoms.push({
                                    type: 'Point',
                                    coordinates: coord1(nodeVal(get1(geomNode, 'coordinates')))
                                });
                            } else if (geotypes[i] === 'LineString') {
                                geoms.push({
                                    type: 'LineString',
                                    coordinates: coord(nodeVal(get1(geomNode, 'coordinates')))
                                });
                            } else if (geotypes[i] === 'Polygon') {
                                var rings = get(geomNode, 'LinearRing'),
                                    coords = [];
                                for (k = 0; k < rings.length; k++) {
                                    coords.push(coord(nodeVal(get1(rings[k], 'coordinates'))));
                                }
                                geoms.push({
                                    type: 'Polygon',
                                    coordinates: coords
                                });
                            } else if (geotypes[i] === 'Track' ||
                                geotypes[i] === 'gx:Track') {
                                var track = gxCoords(geomNode);
                                geoms.push({
                                    type: 'LineString',
                                    coordinates: track.coords
                                });
                                if (track.times.length) coordTimes.push(track.times);
                            }
                        }
                    }
                }
                return {
                    geoms: geoms,
                    coordTimes: coordTimes
                };
            }
            function getPlacemark(root) {
                var geomsAndTimes = getGeometry(root), i, properties = {},
                    name = nodeVal(get1(root, 'name')),
                    styleUrl = nodeVal(get1(root, 'styleUrl')),
                    description = nodeVal(get1(root, 'description')),
                    timeSpan = get1(root, 'TimeSpan'),
                    extendedData = get1(root, 'ExtendedData'),
                    lineStyle = get1(root, 'LineStyle'),
                    polyStyle = get1(root, 'PolyStyle');

                if (!geomsAndTimes.geoms.length) return [];
                if (name) properties.name = name;
                if (styleUrl[0] !== '#') {
                    styleUrl = '#' + styleUrl;
                }
                if (styleUrl && styleIndex[styleUrl]) {
                    properties.styleUrl = styleUrl;
                    properties.styleHash = styleIndex[styleUrl];
                }
                if (description) properties.description = description;
                if (timeSpan) {
                    var begin = nodeVal(get1(timeSpan, 'begin'));
                    var end = nodeVal(get1(timeSpan, 'end'));
                    properties.timespan = { begin: begin, end: end };
                }
                if (lineStyle) {
                    var linestyles = kmlColor(nodeVal(get1(lineStyle, 'color'))),
                        color = linestyles[0],
                        opacity = linestyles[1],
                        width = parseFloat(nodeVal(get1(lineStyle, 'width')));
                    if (color) properties.stroke = color;
                    if (!isNaN(opacity)) properties['stroke-opacity'] = opacity;
                    if (!isNaN(width)) properties['stroke-width'] = width;
                }
                if (polyStyle) {
                    var polystyles = kmlColor(nodeVal(get1(polyStyle, 'color'))),
                        pcolor = polystyles[0],
                        popacity = polystyles[1],
                        fill = nodeVal(get1(polyStyle, 'fill')),
                        outline = nodeVal(get1(polyStyle, 'outline'));
                    if (pcolor) properties.fill = pcolor;
                    if (!isNaN(popacity)) properties['fill-opacity'] = popacity;
                    if (fill) properties['fill-opacity'] = fill === '1' ? 1 : 0;
                    if (outline) properties['stroke-opacity'] = outline === '1' ? 1 : 0;
                }
                if (extendedData) {
                    var datas = get(extendedData, 'Data'),
                        simpleDatas = get(extendedData, 'SimpleData');

                    for (i = 0; i < datas.length; i++) {
                        properties[datas[i].getAttribute('name')] = nodeVal(get1(datas[i], 'value'));
                    }
                    for (i = 0; i < simpleDatas.length; i++) {
                        properties[simpleDatas[i].getAttribute('name')] = nodeVal(simpleDatas[i]);
                    }
                }
                if (geomsAndTimes.coordTimes.length) {
                    properties.coordTimes = (geomsAndTimes.coordTimes.length === 1) ?
                        geomsAndTimes.coordTimes[0] : geomsAndTimes.coordTimes;
                }
                var feature = {
                    type: 'Feature',
                    geometry: (geomsAndTimes.geoms.length === 1) ? geomsAndTimes.geoms[0] : {
                        type: 'GeometryCollection',
                        geometries: geomsAndTimes.geoms
                    },
                    properties: properties
                };
                if (attr(root, 'id')) feature.id = attr(root, 'id');
                return [feature];
            }
            return gj;
        },
        gpx: function(doc) {
            var i,
                tracks = get(doc, 'trk'),
                routes = get(doc, 'rte'),
                waypoints = get(doc, 'wpt'),
                // a feature collection
                gj = fc(),
                feature;
            for (i = 0; i < tracks.length; i++) {
                feature = getTrack(tracks[i]);
                if (feature) gj.features.push(feature);
            }
            for (i = 0; i < routes.length; i++) {
                feature = getRoute(routes[i]);
                if (feature) gj.features.push(feature);
            }
            for (i = 0; i < waypoints.length; i++) {
                gj.features.push(getPoint(waypoints[i]));
            }
            function getPoints(node, pointname) {
                var pts = get(node, pointname),
                    line = [],
                    times = [],
                    heartRates = [],
                    l = pts.length;
                if (l < 2) return {};  // Invalid line in GeoJSON
                for (var i = 0; i < l; i++) {
                    var c = coordPair(pts[i]);
                    line.push(c.coordinates);
                    if (c.time) times.push(c.time);
                    if (c.heartRate) heartRates.push(c.heartRate);
                }
                return {
                    line: line,
                    times: times,
                    heartRates: heartRates
                };
            }
            function getTrack(node) {
                var segments = get(node, 'trkseg'),
                    track = [],
                    times = [],
                    heartRates = [],
                    line;
                for (var i = 0; i < segments.length; i++) {
                    line = getPoints(segments[i], 'trkpt');
                    if (line.line) track.push(line.line);
                    if (line.times && line.times.length) times.push(line.times);
                    if (line.heartRates && line.heartRates.length) heartRates.push(line.heartRates);
                }
                if (track.length === 0) return null;
                var properties = getProperties(node);
                if (times.length) properties.coordTimes = track.length === 1 ? times[0] : times;
                if (heartRates.length) properties.heartRates = track.length === 1 ? heartRates[0] : heartRates;
                return {
                    type: 'Feature',
                    properties: properties,
                    geometry: {
                        type: track.length === 1 ? 'LineString' : 'MultiLineString',
                        coordinates: track.length === 1 ? track[0] : track
                    }
                };
            }
            function getRoute(node) {
                var line = getPoints(node, 'rtept');
                if (!line.line) return null;
                var routeObj = {
                    type: 'Feature',
                    properties: getProperties(node),
                    geometry: {
                        type: 'LineString',
                        coordinates: line.line
                    }
                };
                return routeObj;
            }
            function getPoint(node) {
                var prop = getProperties(node);
                prop.sym = nodeVal(get1(node, 'sym'));
                return {
                    type: 'Feature',
                    properties: prop,
                    geometry: {
                        type: 'Point',
                        coordinates: coordPair(node).coordinates
                    }
                };
            }
            function getProperties(node) {
                var meta = ['name', 'desc', 'author', 'copyright', 'link',
                            'time', 'keywords'],
                    prop = {},
                    k;
                for (k = 0; k < meta.length; k++) {
                    prop[meta[k]] = nodeVal(get1(node, meta[k]));
                }
                return clean(prop);
            }
            return gj;
        },
        fit: function(arrayBuffer) {
            var dataView = new DataView(arrayBuffer);
            var args = {data: dataView, offset: 0};
            var definitions = {};
            var gj = fc(); // a feature collection
            var fileHeader = getFileHeader(args);
            var coordinates = [];

            while (args.offset < fileHeader.dataSize + fileHeader.headerSize) {
                var record = getRecord(args);
                if (definitions[record.header.localType].messageName == 'Record') {
                    var latPos = -1;
                    var lngPos = -1;
                    var fields = definitions[record.header.localType].fields;
                    for (var i in fields) {
                        if (fields[i].fieldName == 'PositionLat')
                            latPos = i;
                        else if (fields[i].fieldName == 'PositionLong')
                            lngPos = i;
                    }
                    if (latPos >= 0 && lngPos >= 0 && record.content[lngPos] && record.content[latPos]) {
                        coordinates.push([semicirclesToDegree(record.content[lngPos]), semicirclesToDegree(record.content[latPos])]);
                    }
                }
            }

            if (coordinates.length) {
                var feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coordinates
                    },
                    "properties": {}
                };
                gj.features.push(feature);
            }

            function semicirclesToDegree(semicircles) {
                return semicircles * 180 / Math.pow(2, 31);
            }
            function getStringFromArray(data, offset, length) {
                var result = '';
                for (var i = 0; i < length; i++)
                    result += String.fromCharCode(data.getUint8(offset + i));
                return result;
            }
            function getFileHeader(args) {
                var {data, offset} = args;
                var result = {
                    headerSize: data.getUint8(offset),
                    protocolVersion: data.getUint8(offset + 1),
                    profileVersion: data.getUint16(offset + 2, true),
                    dataSize: data.getUint32(offset + 4, true),
                    magicString: getStringFromArray(data, offset + 8, 4),
                    crc: data.getUint16(offset + 12, true)
                };
                if (result.magicString !== '.FIT')
                    console.error('Cannot find magic string in the file header: ' + result);
                args.offset += 14;
                return result;
            }
            function getRecordHeader(args){
                var {data, offset} = args;
                var val = data.getUint8(offset);
                args.offset += 1;
                var headerType = (val & (1<<7)) ? 'timestamp' : 'normal';
                if (headerType == 'normal') {
                    return {
                        headerType: headerType,
                        messageType: (val & (1<<6)) ? 'definition' : 'data',
                        localType: (val & 0x0f),
                        developerFields: (val & (1<<5)) ? 1 : 0
                    };
                } else {
                    return {
                        headerType: headerType,
                        localType: (val & 0x3f),
                        timeOffset: (val & 0x0f),
                        developerFields: (val & (1<<5)) ? 1 : 0
                    };
                }
            }
            function getMessageName(data) {
                switch(data) {
                    case 0:
                        return 'FileId';
                    case 20:
                        return 'Record';
                }
                return '' + data;
            }
            function getFieldName(fieldDefinitionNumber) {
                switch(fieldDefinitionNumber) {
                    case 253:
                        return 'Timestamp';
                    case 0:
                        return 'PositionLat';
                    case 1:
                        return 'PositionLong';
                    case 5:
                        return 'Distance';
                }

                return '' + fieldDefinitionNumber;
            }
            function getFieldTypeName(data) {
                switch(data) {
                    case 0:
                        return 'enum';
                    case 1:
                        return 'sint8';
                    case 2:
                        return 'uint8';
                    case 3:
                        return 'sint16';
                    case 4:
                        return 'uint16';
                    case 5:
                        return 'sint32';
                    case 6:
                        return 'uint32';
                    case 7:
                        return 'string';
                    case 8:
                        return 'float32';
                    case 9:
                        return 'float64';
                    case 10:
                        return 'uint8z';
                    case 11:
                        return 'uint16z';
                    case 12:
                        return 'uint32z';
                    case 13:
                        return 'byte';
                    case 14:
                        return 'sint64';
                    case 15:
                        return 'uint64';
                    case 16:
                        return 'uint64z';
                }
                return 'unknown';
            }
            function getFieldType(data) {
                return {
                    endian: (data & (1<<7)) ? 1 : 0,
                    reserved: (data & (1<<6 | 1<<5)) >> 5,
                    type: getFieldTypeName(data & 0x1f),
                };
            }
            function getFieldDefinition(args) {
                var {data, offset} = args;
                var fieldDefinitionNumber = data.getUint8(offset);
                var field = {
                    fieldName: getFieldName(fieldDefinitionNumber),
                    size: data.getUint8(offset + 1),
                    fieldType: getFieldType(data.getUint8(offset + 2))
                };
                args.offset += 3;
                return field;
            }
            function getField(args, fieldDefinition, architecture) {
                var result = undefined;
                var littleEndian = architecture == 0;
                var {data, offset} = args;
                switch(fieldDefinition.fieldType.type) {
                    case 'enum':
                        result = data.getUint8(offset);
                        break;
                    case 'sint8':
                        result = data.getInt8(offset);
                        break;
                    case 'sint16':
                        result = data.getInt16(offset, littleEndian);
                        break;
                    case 'sint32':
                        result = data.getInt32(offset, littleEndian);
                        break;
                    case 'sint64':
                        result = data.getBigInt64(offset, littleEndian);
                        break;
                    case 'uint8':
                        result = data.getUint8(offset);
                        break;
                    case 'uint16':
                        result = data.getUint16(offset, littleEndian);
                        break;
                    case 'uint32':
                        result = data.getUint32(offset, littleEndian);
                        break;
                    case 'uint64':
                        result = data.getBigUint64(offset, littleEndian);
                        break;
                    case 'uint8z':
                        result = data.getUint8(offset);
                        break;
                    case 'uint16z':
                        result = data.getUint16(offset, littleEndian);
                        break;
                    case 'uint32z':
                        result = data.getUint32(offset, littleEndian);
                        break;
                    case 'uint64z':
                        result = data.getBigUint64(offset, littleEndian);
                        break;
                    case 'float32':
                        result = data.getFloat32(offset, littleEndian);
                        break;
                    case 'float64':
                        result = data.getFloat64(offset, littleEndian);
                        break;
                    case 'string':
                        result = '';
                        for (var i = 0; i < fieldDefinition.size; i++)
                            result += String.fromCharCode(data.getUint8(offset + i));
                        break;
                    case 'byte':
                        result = data.getUint8(offset);
                        break;
                    default:
                        console.error('unsupported field type: "' + JSON.stringify(fieldDefinition.fieldType) + '"');
                        break;
                }
                args.offset += fieldDefinition.size;
                return result;
            }
            function getDefinitionContent(args, developerFields) {
                var {data, offset} = args;
                var architecture = data.getUint8(offset + 1);
                var littleEndian = architecture == 0;
                var messageNumber = data.getUint16(offset + 2, littleEndian);
                var result = {
                    reserved: data.getUint8(offset),
                    architecture: architecture,
                    messageNumber: messageNumber,
                    messageName: getMessageName(messageNumber),
                    fieldsCount: data.getUint8(offset + 4),
                    devFieldsCount: 0,
                    fields: []
                };
                args.offset += 5;
                for (var i = 0; i < result.fieldsCount; i++)
                    result.fields.push(getFieldDefinition(args));
                if (developerFields) {
                    var devFieldsCount = data.getUint8(args.offset);
                    result.devFieldsCount = devFieldsCount;
                    args.offset += 1;
                    for (var i = 0; i < devFieldsCount; i++)
                        result.fields.push(getFieldDefinition(args));
                }
                return result
            }
            function getRecordContent(args, localType) {
                var result = [];
                var definition = definitions[localType];
                if (definition) {
                    for (var i = 0; i < definition.fieldsCount; i++)
                        result.push(getField(args, definition.fields[i], i === 0, definition.architecture));
                } else {
                    console.error('not found definition: "' + localType + '"');
                }
                return result
            }
            function getRecord(args) {
                var header = getRecordHeader(args);
                var content = undefined;
                if (header.headerType == 'normal' && header.messageType == 'definition') {
                    content = getDefinitionContent(args, header.developerFields);
                    definitions[header.localType] = content;
                } else {
                    content = getRecordContent(args, header.localType);
                }
                var result = {
                    header: header,
                    content: content
                };
                return result;
            }
            return gj;
        }
    };
    return t;
})();

if (typeof module !== 'undefined') module.exports = toGeoJSON;
