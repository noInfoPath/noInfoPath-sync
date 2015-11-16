module.exports = function(grunt) {

	var DEBUG = !!grunt.option("debug");
	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			noinfopath: {
				src: [
					'src/globals.js',
					'src/socket.js',
					'src/directives.js'
				],
				dest: 'dist/noinfopath-sync.js',
			}
		},
		bumpup: {
			file: 'package.json'
		},
		version: {
			options: {
				prefix: '@version\\s*'
			},
			defaults: {
				src: ['src/globals.js']
			}
		},
		nodocs: {
			"internal": {
				options: {
					src: 'dist/noinfopath-sync.js',
					dest: 'docs/noinfopath-sync.md',
					start: ['/*', '/**']
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-karma');
	grunt.loadNpmTasks('grunt-bumpup');
	grunt.loadNpmTasks('grunt-version');
	grunt.loadNpmTasks('grunt-nodocs');

	// // Default task(s).
	//grunt.registerTask('default', ['bower', 'yuidoc', 'appcache']);
	//grunt.registerTask('default', ['jsdoc2md']);
	grunt.registerTask('compile', ['concat:noinfopath','nodocs:internal']);
	grunt.registerTask('build', ['bumpup','version','concat:noinfopath','nodocs:internal']);

};
