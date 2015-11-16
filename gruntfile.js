module.exports = function(grunt) {

	var DEBUG = !!grunt.option("debug");
	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			noinfopath: {
				src: ['src/*.js'],
				dest: 'dist/noinfopath-sync.js',
			}
		},
		copy: {
			build: {
				files: [{
						expand: true,
						flatten: false,
						src: ['lib/js/noinfopath/*.*'],
						dest: 'build/'
					}, {
						expand: true,
						flatten: false,
						src: ['lib/**/*.*'],
						dest: 'build/'
					},
					//{expand:true, flatten:true, src: [ 'src/js/*.*'], dest: 'build/js/'},
					//{expand:true, flatten:true, src: [ 'src/js/controllers/*.*'], dest: 'build/js/controllers/'},
					//{expand:true, flatten:true, src: [ 'src/js/directives/*.*'], dest: '../fcfn-test-server-node/fcfn/js/directives/'},
					{
						expand: true,
						flatten: false,
						cwd: 'src',
						src: ['entity/**/*.*', '!entity/**/config.json'],
						dest: 'build/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/userManager/*.*'],
						dest: 'build/userManager/'
					},
					//{expand:true, flatten:true, src: [ 'src/img/*.*'], dest: '../fcfn-test-server-node/fcfn/img/'},
					//{expand:true, flatten:true, src: [ 'src/templates/*.*'], dest: '../fcfn-test-server-node/fcfn/templates/'},
					{
						expand: true,
						flatten: true,
						src: ['src/*.*', '!src/fcfn.appcache'],
						dest: 'build/'
					},
					//{expand:true, flatten:true, src: [ 'src/components/angular-cookies/angular-cookies.js'], dest: 'build/lib/js/'},
					//{expand:true, flatten:true, src: [ 'src/components/rdash-ui/dist/css/rdash.css'], dest: 'build/lib/css/'},
					{
						expand: true,
						flatten: true,
						src: ['src/observations/*.*'],
						dest: 'build/observations/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/observations/editor/*.*'],
						dest: 'build/observations/editor/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/observations/summary/*.*'],
						dest: 'build/observations/summary/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/lookups/*.*'],
						dest: 'build/lookups/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/picker/*.*'],
						dest: 'build/picker/'
					}, {
						expand: true,
						flatten: false,
						cwd: 'src',
						src: ['images/**/*.*', '!images/**/*.db'],
						dest: 'build/'
					},
					//{expand:true, flatten:true, src: ['src/images/logos/*.*'], dest: '../fcfn-test-server-node/fcfn/images/logos'},
					{
						expand: true,
						flatten: true,
						src: ['src/*.*'],
						dest: 'build/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/config/config.json'],
						dest: 'build/'
					}

				]
			},
			production: {
				files: [
					//{expand:true, flatten:false, src: [ 'lib/**/*.*'], dest: '../fcfn-test-server-node/fcfn/'},
					{
						expand: true,
						flatten: false,
						src: ['lib/js/noinfopath/*.*'],
						dest: '../fcfn-test-server-node/fcfn/'
					},
					//{expand:true, flatten:false, src: [ 'lib/js/**/*.*'], dest: '../fcfn-test-server-node/fcfn/'},
					{
						expand: true,
						flatten: true,
						src: ['src/js/*.*'],
						dest: '../fcfn-test-server-node/fcfn/js/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/js/controllers/*.*'],
						dest: '../fcfn-test-server-node/fcfn/js/controllers/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/js/directives/*.*'],
						dest: '../fcfn-test-server-node/fcfn/js/directives/'
					},
					//{expand:true, flatten:true, src: [ 'src/img/*.*'], dest: '../fcfn-test-server-node/fcfn/img/'},
					{
						expand: true,
						flatten: true,
						src: ['src/templates/*.*'],
						dest: '../fcfn-test-server-node/fcfn/templates/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/*.*'],
						dest: '../fcfn-test-server-node/fcfn/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/components/angular-cookies/angular-cookies.js'],
						dest: '../fcfn-test-server-node/fcfn/lib/js/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/components/rdash-ui/dist/css/rdash.css'],
						dest: '../fcfn-test-server-node/fcfn/lib/css/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/observations/*.*'],
						dest: '../fcfn-test-server-node/fcfn/observations/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/observations/editor/*.*'],
						dest: '../fcfn-test-server-node/fcfn/observations/editor/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/lookups/*.*'],
						dest: '../fcfn-test-server-node/fcfn/lookups/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/picker/*.*'],
						dest: '../fcfn-test-server-node/fcfn/picker/'
					}, {
						expand: true,
						flatten: true,
						src: ['src/images/*.*'],
						dest: '../fcfn-test-server-node/fcfn/images'
					}, {
						expand: true,
						flatten: true,
						src: ['src/images/logos/*.*'],
						dest: '../fcfn-test-server-node/fcfn/images/logos'
					}, {
						expand: true,
						flatten: true,
						src: ['src/*.*'],
						dest: '../fcfn-test-server-node/fcfn/'
					}
				]
			},
			dev: {
				files: [{
					expand: true,
					flatten: false,
					cwd: 'build',
					src: ['!**/*.db', '**/*.*'],
					dest: '../fcfn-test-server-node/fcfn'
				}, ]
			},
			lib: {
				files: [
					//{expand:true, flatten:true, src: ['node_modules/noinfopath-*/noinfopath-*.js'], dest: 'lib/js/noinfopath/'},
					{
						expand: true,
						flatten: true,
						src: ['node_modules/@noinfopath/noinfopath*/dist/*.js'],
						dest: 'lib/js/noinfopath/'
					}, {
						expand: true,
						flatten: true,
						src: ['node_modules/oclazyload/dist/oclazyload.js'],
						dest: 'lib/js/'
					}, {
						expand: true,
						flatten: true,
						src: ['node_modules/angular-validation/dist/angular-validation-rule.min.js'],
						dest: 'lib/js/angular-validation/'
					}, {
						expand: true,
						flatten: true,
						src: ['node_modules/angular-validation/dist/angular-validation.min.js'],
						dest: 'lib/js/angular-validation/'
					},
					//   {expand:true, flatten:true, src: ['src/components/angular-form-builder/angular-form-builder.js'], dest: 'lib/js/'},
					//   {expand:true, flatten:true, src: ['src/components/angular-form-builder/angular-form-builder-components.js'], dest: 'lib/js/'},
					//   {expand:true, flatten:true, src: ['src/components/angular-form-builder/angular-form-builder.css'], dest: 'lib/css/'},
					//   {expand:true, flatten:true, src: ['src/components/angular-block-ui/dist/angular-block-ui.js'], dest: 'lib/js/'},
					//   {expand:true, flatten:true, src: ['src/components/angular-block-ui/dist/angular-block-ui.js.map'], dest: 'lib/js/'},
					//   {expand:true, flatten:true, src: ['src/components/angular-sanitize/angular-sanitize.js'], dest: 'lib/js/'},
					//   {expand:true, flatten:true, src: ['src/components/angular-sanitize/angular-sanitize.js.map'], dest: 'lib/js/'},
					//   {expand:true, flatten:true, src: ['src/components/angular-block-ui/dist/angular-block-ui.css'], dest: 'lib/css/'},
					//   {expand:true, flatten:true, src: ['src/components/angular-block-ui/dist/angular-block-ui.css.map'], dest: 'lib/css/'},
					//   {expand:true, flatten:true, src: ['src/components/ng-lodash/build/ng-lodash.min.js'], dest: 'lib/js/'},
					//   {expand:true, flatten:true, src: ['node_modules/dexie/dist/latest/Dexie.js'], dest: 'lib/js/', filter: 'isFile'},
					//   {expand:true, flatten:true, src: ['node_modules/dexie/dist/latest/Dexie.Syncable.js'], dest: 'lib/js/', filter: 'isFile'},
					{
						expand: true,
						flatten: true,
						src: ['bower_components/angular-base64/angular-base64.min.js'],
						dest: 'lib/js/',
						filter: 'isFile'
					}, {
						expand: true,
						flatten: true,
						src: ['bower_components/angular-http-auth/src/http-auth-interceptor.js'],
						dest: 'lib/js/',
						filter: 'isFile'
					}, {
						expand: true,
						flatten: true,
						src: ['bower_components/angular-bootstrap/ui-bootstrap.js'],
						dest: 'lib/js/angular-bootstrap/',
						filter: 'isFile'
					}, {
						expand: true,
						flatten: true,
						src: ['bower_components/angular-bootstrap/ui-bootstrap-tpls.js'],
						dest: 'lib/js/angular-bootstrap/',
						filter: 'isFile'
					}
				]
			}
		},
		watch: {
			dev: {
				files: ['src/**/*.*', 'lib/js/noinfopath/*.*'],
				tasks: ['build'],
				options: {
					// livereload: true
				}
			}
		},
		karma: {
			unit: {
				configFile: "karma.conf.js"
			}
		},
		appcache: {
			options: {
				basePath: 'build',
				ignoreManifiest: true
			},
			all: {
				dest: 'build/fcfn.appcache',
				cache: {
					patterns: [
						'build/**/*',
						'!build/**/*.map'
					]
				},
				network: '*',
				fallback: [
					"lib/fonts/fontawesome-webfont.woff lib/fonts/fontawesome-webfont.woff",
					"lib/fonts/fontawesome-webfont.eot lib/fonts/fontawesome-webfont.eot",
					"lib/fonts/fontawesome-webfont.svg lib/fonts/fontawesome-webfont.svg",
					"lib/fonts/fontawesome-webfont.ttf lib/fonts/fontawesome-webfont.ttf",
					"lib/fonts/FontAwesome.otf lib/fonts/FontAwesome.otf"
				]
			}
		},
		jshint: {
			afterconcat: ['src/config/config.json']
		}
	});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-karma');

	// // Default task(s).
	//grunt.registerTask('default', ['bower', 'yuidoc', 'appcache']);
	//grunt.registerTask('default', ['jsdoc2md']);
	grunt.registerTask('compile', ['concat:noinfopath']);

};
