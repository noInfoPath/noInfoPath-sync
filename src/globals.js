//globals.js
/*
*	# noinfopath-sync
*	@version 2.0.22
*
*	## Overview
*	Provides data synchronization services.
*/
(function(angular){
	/*
	*	## @class NoSyncData
	*
	*	TODO: Add description.
	*/
	function NoSyncData(data) {

		//Defaults
		this.attempts = 0;
		this.error  = "";
		//this.inProgress = false;
		this.state = "connecting";

		var _initializing = true;
		this.initialized= function() {
			_initializing = false;
		};

		var _inProgress = false;
		Object.defineProperty(this, "inProgress", {
			get: function(){
				return _inProgress;
			},
			set: function(v) {
				_inProgress = v;
			}
		});

		/*
		*	#### String lastSync (read only)
		*
		*	##### getter
		*	Returns the amount of time that has past since the last sync event.
		*/
		Object.defineProperty(this, "lastSync", {
			get: function(){
				var t = moment(this.lastSyncTimestamp).fromNow();
				return t === "Invalid date" ? "never" : t;
			}
		});

		/*
		*	#### Boolean needChanges (read only)
		*
		*	##### getter
		*	Return true if the `previousVersion` is greater than zero, and `version`
		*	is greater than `previousVersion`.
		*/
		Object.defineProperty(this, "needChanges", {
			get: function(){
				return _initializing ||  (this.previous.version > 0 && this.previous.version < this.previous.version);
			}
		});

		var _internalDate = new Date();
		Object.defineProperty(this, "lastSyncTimestamp", {
			get: function(){
				return _internalDate;
			},
			set: function(v) {
				if(angular.isString(v)) {
					_internalDate = new Date(v);
				} else if(angular.isDate(v)) {
					_internalDate = v;
				}
			}
		});

		/*
		*	#### Obect previousVersion (read only)
		*
		*	##### getter
		*	Return the pervious version update information, if any.
		*	Otherwise returns `null`
		*/
		var _prevVersion = {version: 0};
		Object.defineProperty(this, "previous", {
			get: function(){

				return _prevVersion;
			}
		});

		/*
		*	#### Object version (read/write)
		*
		*	##### getter
		*	returns the current version object used for requesting data from DTCS.
		*
		*	##### setter
		*	Set the `previousVersion` to the current `version`, then sets
		*	current 'version' to the assignment value.  Finally, sets the
		*	`pending` property to true.
		*
		*/
		var _version = {version: 0};
		Object.defineProperty(this, "current", {
			get: function(){
				return _version;
			},
			set: function(v) {

				_prevVersion = _version;
				_version = v || _version;
				_pending = true;
				_inProgress = false;
				_internalDate = new Date();
			}
		});

		/*
		*	#### Boolean (read/write)
		*
		*	##### getter
		*	Returns the current pending state.
		*
		*/
		var _pending = false;
		Object.defineProperty(this, "pending", {
			get: function(){
				return _pending;
			}
		});

		/*
		*	#### clearPending()
		*
		*	Set the pending state to false.
		*/
		this.clearPending = function() {
			_pending = false;
		};

		this.finished = function(){
			_pending = false;
			_inProgress = false;
			_internalDate = new Date();
			_prevVersion = _version;
		};

		this.start = function() {
			_inProgress = true;
		};

		//Merge with data
		if(data) {
			//this.lastSyncTimestamp = data.lastSyncTimestamp || this.lastSyncTimestamp;
			this.current = data.version;
		}

		/*
		*	#### String toJSON()
		*
		*	Return a pure javascript object suitable for persistence in localStorage.
		*/
		this.toJSON = function() {
			var ds = Object.getOwnPropertyDescriptors(this),
				o = {},
				blacklist = ["attempts", "error", "inProgress", "state", "lastSync"];
			for(var k in ds) {
				var d = ds[k],
					t = this[k],
					f = angular.isFunction(t);


				if(!f && blacklist.indexOf(k) === -1) {
					o[k] = t;
				}
			}
			return JSON.stringify(o);
		};

		this.update = function(key, value) {
			this[key] = value;
		};


	}


	/*
	*	#### Static NoSyncData fromJSON(data)
	*
	*	Returns a new NoSyncData intances hydrated with the provide pure javascript object.
	*/
	NoSyncData.fromJSON = function(data) {
		var tmp = angular.isString(data) ? JSON.parse(data) : data;
			obj = new NoSyncData(tmp);

		return obj;
	};

	NoSyncData.prototype.toString = function() {
		var ret = "Sync Status\n-----------------------" + "\nCurrent Version: " + this.current.version + "\nPrevious Version: " + this.previous.version +  "\nState: " + this.state + "\nNeedChanges: " + this.needChanges + "\nPending: " + this.pending + "\nIn Progress: " + this.inProgress;

		return ret;
	};
	noInfoPath.NoSyncData = NoSyncData;

	angular.module("noinfopath.sync", []);
})(angular);
