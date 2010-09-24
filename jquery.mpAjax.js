/*! mpAjax (multi-part Ajax responses)
	v0.3.4 (c) Kyle Simpson
	MIT License
*/

;(function($){
	var old_$ajax = $.ajax, 
		old_$ajaxSuccess = $.fn["ajaxSuccess"],
		
		delimiter_stub = "!!!!!!=_NextPart_",			// change these if you want a different delimiter format
		delimiter_regexp = delimiter_stub+"[0-9.]+",
		
		s2 = null			// an array of objects that have the "ajaxSuccess" handler bound to them
	;

	$.fn.extend({
		unbind: function(type,fn) {
			if (type === "ajaxSuccess" && s2 !== null && s2.length > 0) {
				var elem = this.get(0);
				s2 = $(s2).filter(function(){return this!==elem;}).get();
			}
			return this.each(function(){
				$.event.remove( this, type, fn );
			});
		},
		ajaxSuccess: function(f) {
			if (s2 === null) s2 = [];
			s2.push(this.get(0));
			if (typeof f !== "function") {
				var handlers = f;
				f = function(){};
				f.mp_handlers = handlers;
			}
			return old_$ajaxSuccess.call(this,f);
		}
	});
	
	function faster_trim(str) {
		// from: http://blog.stevenlevithan.com/archives/faster-trim-javascript
		var	str = str.replace(/^\s\s*/, ''),
			ws = /\s/,
			i = str.length;
		while (ws.test(str.charAt(--i)));
		return str.slice(0, i + 1);
	}

	function parseEngine() {
		var processed_data = null, multipart = false, publicAPI = null, _data = null;
		
		function parse_part(part) {
			var part_obj = {};
			part = faster_trim(part);
			var temp_part = part.replace(/\n|\r/gm,"\t"),
				each_headers_pattern = /^(((content-type)|(content-length))\s*?:\s*?(\S+))/igm,
				all_headers_pattern = /^(((content-type)|(content-length))\s*?:\s*?([^\t]+)\t+)+/ig,
				headers
			;
			each_headers_pattern.lastIndex = all_headers_pattern.lastIndex = 0; // reset global regexes to prevent some browser caching bugs
			
			headers = temp_part.match(all_headers_pattern);
			if (headers && headers.length > 0) {
				var allheaders = headers[0];
				headers = part.match(each_headers_pattern);
				for (var i=0; i<headers.length; i++) {
					if (allheaders.indexOf(headers[i]) !== -1) {
						var header_parts = headers[i].split(":");
						var key = faster_trim(header_parts[0]), val = faster_trim(header_parts[1]);
						part_obj[key.toLowerCase()] = val;
					}
				}
				each_headers_pattern.lastIndex = 0;
				part = part.replace(each_headers_pattern,"");
			}
			else {
				part_obj["content-type"] = "plain/text";
			}
			part = part.replace(/^\s\s*/,"");
			part_obj.data = part;
			return part_obj;
		}
		
		publicAPI = {
			multipart:function(){return multipart;},
			processData:function(data,successFn) {
				if (_data !== data) {
					processed_data = [];
					_data = data;
					multipart = false;

					var delims = null, 
						temp_data, 
						delim_pattern = new RegExp(delimiter_regexp+"\s*?$","igm"), 
						parts
					;
					// check if data is a string, if it's non-empty (trim'd), and if it has the right delimiter pattern
					if ((typeof data === "string") && (temp_data = faster_trim(data)) && (delims = temp_data.match(delim_pattern))) { 
						multipart = true;
						delim_pattern.lastIndex = 0;
						parts = $(temp_data.split(delim_pattern)).filter(function(){
							return this != "" && this.replace(/[\n\r]/g,"") != "";
						}).get();
						if (parts.length > delims.length) delims.unshift(delimiter_stub+Math.random());	// less delims than parts, add implicit delim at beginning
						else if (delims.length > parts.length) parts.push("");	// less parts than delims, add empty implicit part at end
						for (var i=0; i<parts.length; i++) {
							var part = parse_part(parts[i]);
							part.delimiter = faster_trim(delims[i]);
							processed_data.push(part);
						}
					}
					else {	// format non-multi-part data for consistent 'success' handler processing
						if (typeof successFn === "function") processed_data = data;
						else if ($.isArray(successFn)) processed_data.push(data);
						else if (typeof successFn === "object") { processed_data.push({"content-type":"plain/text",delimiter:"",data:data}); }
					}
				}
				return processed_data;
			}
		};
		return publicAPI;
	}
	
	$.extend({
		ajax:function(s) {
			var s1 = s.success || null;
			if (s1 !== null || (s2 !== null && s2.length > 0)) {
				var engine = parseEngine(),
					success_trigger = function(data,args,sFunc,replaceData) {
						var _this = this;
						args = $.makeArray(args), // copy/dup the array to prevent unintended modifications
						replaceData = !(!replaceData);
						if (replaceData) args.unshift(data); // add "data" argument back to beginning of "success" handler call
						else args.push(data);	// append "data" argument onto end of "ajaxSuccess" handler call
						sFunc.apply(_this,args);
					},
					data_map_and_trigger = function() {
						var _this = this,
							args = $.makeArray(arguments), 
							processed_data = args[0], 
							replaceData = args[1], 
							successFn = args[2]
						;
						args.shift(); // remove "processed_data" argument
						args.shift(); // remove "replaceData" argument
						args.shift(); // remove "successFn" argument
						if (replaceData) args.shift(); // remove "data" argument from "success" handler call, we'll add it back later
						try {
							if (typeof successFn === "function") {
								success_trigger.call(_this,processed_data,args,successFn,replaceData);
							}
							else if ($.isArray(successFn)) {
								for (var i=0; i<successFn.length; i++) {
									if (typeof successFn[i] === "function" && typeof processed_data[i] !== "undefined") { 
										success_trigger.call(_this,processed_data[i],args,successFn[i],replaceData);
									}
								}
							}
							else if (typeof successFn === "object") {
								for (var i=0; i<processed_data.length; i++) {
									var ct = processed_data[i]["content-type"], dataToPass = null;
									if (typeof successFn[ct] === "function") {
										if (engine.multipart()) dataToPass = processed_data[i];	// response was multipart, assume handler is expecting a processed_data object
										else dataToPass = processed_data[i].data;	// response was not multi-part, assume handler expects a data string
										success_trigger.call(_this,dataToPass,args,successFn[ct],replaceData);
									}
								}
							}
						} catch (err) { }
					}
				;
				if (s1 !== null) {
					if (typeof s.success.__mpAjax === "undefined") {
						s.success = function() { 
							var args = $.makeArray(arguments), _this = this;
							try { 
								var processed_data = engine.processData(args[0],s1);
								args.unshift(s1);
								args.unshift(true);	// *replace* the data argument in the "success" call signature
								args.unshift(processed_data);
								data_map_and_trigger.apply(_this,args);
							} catch (err) { }
						};
						s.success.__mpAjax = true;
					}
				}
				if (s2 !== null && s2.length > 0) {	// s2 is an array of objects that have the ajaxSuccess handler bound to them
					$(s2).each(function(){	// loop through stored object/handler refs which were bound to "ajaxSuccess"
						var evts = $(this).data("events");
						if (typeof evts !== "undefined" && evts !== null && typeof evts["ajaxSuccess"] === "object") { // is object/handler ref still bound to "ajaxSuccess"?
							for (var i in evts["ajaxSuccess"]) {
								if (evts["ajaxSuccess"][i] !== Object.prototype[i]) {
									var s2_func = evts["ajaxSuccess"][i];
									if (typeof s2_func.__mpAjax === "undefined") { // prevent wrapping the handler more than once
										evts["ajaxSuccess"][i] = function(){
											var args = $.makeArray(arguments), _this = this;
											try {
												var processed_data = engine.processData(args[1].responseText,s2_func);
												if (typeof s2_func.mp_handlers !== "undefined") args.unshift(s2_func.mp_handlers);
												else args.unshift(s2_func);
												
												args.unshift(false); // *append* the data argument to the "ajaxSuccess" call signature
												args.unshift(processed_data);
												data_map_and_trigger.apply(_this,args);
											}
											catch (err) { }
										};
										evts["ajaxSuccess"][i].__mpAjax = true; // mark this success handler as wrapped by mpAjax
										evts["ajaxSuccess"][i].guid = s2_func.guid;
										evts["ajaxSuccess"][i].type = s2_func.type;
										$(this).data("events",evts);
									}
								}
							}
						}
					});
				}
			}
			return old_$ajax.call(this,s);
		}
	});
})(jQuery);