project('gnome-maps', 'c',
	version: '41.alpha',
	license: 'GPL2+'
)

app_id = 'org.gnome.Maps'
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
appstream_util = find_program('appstream-util', required: false)

glib = dependency('glib-2.0', version: '>= 2.66.0')
gio = dependency('gio-2.0', version: '>= 2.44.0')
gjs = dependency('gjs-1.0', version: '>= 1.66.0')
girepository = dependency('gobject-introspection-1.0', version: '>= 0.10.1')
gtk3 = dependency('gtk+-3.0', version: '>= 3.22.0')
geoclue2 = dependency('geoclue-2.0', version: '>= 0.12.99')
handy = dependency('libhandy-1', version: '>= 0.84.0')

libmaps_deps = [
	dependency('gee-0.8', version: '>= 0.16.0'),
	dependency('folks', version: '>= 0.10.0'),
	dependency('geocode-glib-1.0', version: '>= 3.15.2'),
	dependency('champlain-0.12', version: '>= 0.12.14'),
	dependency('libxml-2.0'),
	dependency('rest-0.7', version: '>= 0.7.90')
]

msgfmt = find_program('msgfmt')
po_dir = join_paths(meson.source_root(), 'po')

top_inc = include_directories('.')

cc = meson.get_compiler('c')

subdir('po')
subdir('src')
subdir('lib')
subdir('data')
subdir('tests')

meson.add_install_script(
  'meson_post_install.py',
  datadir,
  bindir
)
