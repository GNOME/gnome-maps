maps_h = 'maps.h'

headers_private = files(
	'maps-file-tile-source.h',
	'maps-osm.h',
	'maps-osm-changeset.h',
	'maps-osm-node.h',
	'maps-osm-object.h',
	'maps-osm-way.h',
	'maps-osm-relation.h',
	'maps-osm-oauth-proxy-call.h'
)

sources = files(
	'maps-file-tile-source.c',
	'maps-osm.c',
	'maps-osm-changeset.c',
	'maps-osm-node.c',
	'maps-osm-object.c',
	'maps-osm-way.c',
	'maps-osm-relation.c',
	'maps-osm-oauth-proxy-call.c'
)

enum_types = 'maps-enum-types'

maps_enums = gnome.mkenums(
	enum_types,
	sources: headers_private,
	c_template: enum_types + '.c.template',
	h_template: enum_types + '.h.template',
	identifier_prefix: maps_ns,
	symbol_prefix: maps_ns.to_lower()
)

cflags = [
	'-DG_DISABLE_DEPRECATED',
  	'-DPREFIX="@0@"'.format(prefix),
  	'-DLIBDIR="@0@"'.format(libdir)
]

libmaps = shared_library(
	maps_libname,
	version: '0.0.0',
	sources: sources + maps_enums,
	include_directories: top_inc,
	dependencies: libmaps_deps,
	c_args: cflags,
	install: true,
	install_dir: pkglibdir
)

gnome.generate_gir(
	libmaps,
	sources: sources + [maps_enums, headers_private],
	nsversion: maps_gir_version,
	namespace: maps_gir_name,
	identifier_prefix: maps_ns,
	symbol_prefix: maps_ns.to_lower(),
	includes: [
		'GLib-2.0',
		'GObject-2.0',
		'GeocodeGlib-1.0',
		'Champlain-0.12',
		'Rest-0.7'
	],
	install: true,
	install_dir_gir: join_paths(pkgdatadir, 'gir-' + maps_gir_version),
	install_dir_typelib: join_paths(pkglibdir, 'girepository-' + maps_gir_version)
)

