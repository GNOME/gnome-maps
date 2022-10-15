tests = ['addressTest', 'boundingBoxTest', 'colorTest', 'osmNamesTest',
         'placeIconsTest', 'placeZoomTest', 'timeTest', 'translationsTest',
         'utilsTest', 'urisTest', 'wikipediaTest']

# suffix for source resources (so we get /org/gnome/Maps or
# /org/gnome/Maps/Devel, depending on the profile)
if (get_option('profile') == 'development')
	suffix = '/Devel'
else
	suffix = ''
endif

foreach test : tests
  script_conf = configuration_data()
  script_conf.set('GJS', gjs.full_path())
  script_conf.set('PACKAGE_VERSION', version)
  script_conf.set('libdir', libdir)
  script_conf.set('prefix', prefix)
  script_conf.set('name', test)
  script_conf.set('suffix', suffix)
  configure_file(
    input: 'test.in',
    output: test,
    configuration: script_conf,
    install: false,
    install_dir: pkgdatadir
  )
endforeach

sources_conf = configuration_data()
sources_conf.set('suffix', suffix)
# include test sources
sources_conf.set('testopencomment', '')
sources_conf.set('testclosecomment', '')

# generate combined GResource with source files and tests to use ES modules
gnome.compile_resources(
  'test.src',
  configure_file(
	input: '../src/org.gnome.Maps.src.gresource.xml.in',
	output: 'test.src.gresource.xml',
	configuration: sources_conf
  ),
  gresource_bundle: true,
  install: false,
  install_dir: meson.project_build_root(),
  source_dir: ['../src', '../src/geojson-vt']
)

foreach test : tests
  test(test, gjs,
       args: ['tests/@0@'.format(test),
              join_paths(meson.project_build_root(), 'tests', 'test.src.gresource')],
       env:  ['LANG=en_US.utf8', 'LC_ALL=en_US.utf8']
  )
endforeach

