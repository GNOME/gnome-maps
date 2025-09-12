project('gnome-maps', 'c',
	version: '50.alpha',
	license: 'GPL-2.0-or-later',
	meson_version: '>= 0.61.0',
)

app_id = 'org.gnome.Maps'

if get_option('profile') == 'development'
	app_id = 'org.gnome.Maps.Devel'
endif

fs = import('fs')
gnome = import('gnome')
i18n = import('i18n')

prefix = get_option('prefix')
name = meson.project_name()
version = meson.project_version()

bindir = join_paths(prefix, get_option('bindir'))
libdir = join_paths(prefix, get_option('libdir'))
datadir = join_paths(prefix, get_option('datadir'))
pkgdatadir = join_paths(datadir, name)
pkglibdir = join_paths(libdir, name)

maps_ns = 'Maps'
maps_libname = 'gnome-maps'
maps_gir_name = 'GnomeMaps'
maps_gir_version = '1.0'

desktop_file_validate = find_program('desktop-file-validate', required: false)
appstreamcli = find_program('appstreamcli', required: false)

glib = dependency('glib-2.0', version: '>= 2.66.0')
gio = dependency('gio-2.0', version: '>= 2.44.0')
gjs = dependency('gjs-1.0', version: '>= 1.69.2')
girepository = dependency('gobject-introspection-1.0', version: '>= 0.10.1')
gtk4 = dependency('gtk4', version: '>= 4.10')
geoclue2 = dependency('libgeoclue-2.0', version: '>= 0.12.99')
libadwaita = dependency('libadwaita-1', version: '>= 1.8.alpha')
gweather = dependency('gweather4', version: '>= 3.90.0')
geocodeglib = dependency('geocode-glib-2.0', version: '>= 3.15.2')
libportal = dependency('libportal')
shumate = dependency('shumate-1.0', version: '>= 1.5.alpha')

cc = meson.get_compiler('c')

libmaps_deps = [
	shumate,
	dependency('libxml-2.0'),
	dependency('rest-1.0'),
	dependency('librsvg-2.0'),
	dependency('json-glib-1.0'),
	cc.find_library('m', required: true),
]

msgfmt = find_program('msgfmt')
po_dir = join_paths(meson.project_source_root(), 'po')

top_inc = include_directories('.')

cc = meson.get_compiler('c')

gjs = find_program('gjs')

subdir('po')
subdir('src')
subdir('lib')
subdir('data')
subdir('tests')

gnome.post_install(
  glib_compile_schemas: true,
  gtk_update_icon_cache: true,
  update_desktop_database: true,
)
