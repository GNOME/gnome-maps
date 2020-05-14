script_conf = configuration_data()
script_conf.set('GJS', find_program('gjs').path())
script_conf.set('PACKAGE_VERSION', version)
script_conf.set('libdir', libdir)
script_conf.set('prefix', prefix)

tests = ['utilsTest']

foreach test : tests
  script_conf.set('name', test)
  configure_file(
    input: 'test.in',
    output: test,
    configuration: script_conf,
    install: false,
    install_dir: pkgdatadir
  )
endforeach

foreach test : tests
  test(test, find_program('gjs'),
       args: ['-I', '../src/', '-I', '../tests/', 'tests/@0@'.format(test)],
       env:  ['LANG=C', 'LC_ALL=C']
  )
endforeach
