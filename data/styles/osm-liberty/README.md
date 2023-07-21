# OSM Liberty style

This is the vector style currently used in Maps. It is taken from
<https://github.com/maputnik/osm-liberty> at commit [539d0525](https://github.com/maputnik/osm-liberty/commit/539d0525421eb5be901ede630c49947dfe5a343f),
with a few modifications:

- Removed the Natural Earth raster layer, since libshumate doesn't support that
  yet
- Removed the 3D buildings layer, since libshumate doesn't support fill-extrusion
  layers yet
- Changed the tile source URL
- Added "libshumate:cursor": "pointer" to some symbol layers

OSM Liberty is covered by several licenses. See LICENSE.md, which is copied
from the upstream repository.
