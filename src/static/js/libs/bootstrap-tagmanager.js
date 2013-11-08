/* ===================================================
 * bootstrap-tagmanager.js v2.4.2
 * http://welldonethings.com/tags/manager
 * ===================================================
 * Copyright 2012 Max Favilli
 *
 * Licensed under the Mozilla Public License, Version 2.0 You may not use this work except in compliance with the License.
 *
 * http://www.mozilla.org/MPL/2.0/
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

(function($) {

  "use strict";

	if (typeof console === "undefined" || typeof console.log === "undefined") {
		console = {};
		console.log = function() {
		};
	}
	// ///Begin twitter bootstrap
	var VERSION = "0.9.3";

	var utils = {
		isMsie : function() {
			var match = /(msie) ([\w.]+)/i.exec(navigator.userAgent);
			return match ? parseInt(match[2], 10) : false;
		},
		isBlankString : function(str) {
			return !str || /^\s*$/.test(str);
		},
		escapeRegExChars : function(str) {
			return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
		},
		isString : function(obj) {
			return typeof obj === "string";
		},
		isNumber : function(obj) {
			return typeof obj === "number";
		},
		isArray : $.isArray,
		isFunction : $.isFunction,
		isObject : $.isPlainObject,
		isUndefined : function(obj) {
			return typeof obj === "undefined";
		},
		bind : $.proxy,
		bindAll : function(obj) {
			var val;
			for ( var key in obj) {
				$.isFunction(val = obj[key]) && (obj[key] = $.proxy(val, obj));
			}
		},
		indexOf : function(haystack, needle) {
			for ( var i = 0; i < haystack.length; i++) {
				if (haystack[i] === needle) {
					return i;
				}
			}
			return -1;
		},
		each : $.each,
		map : $.map,
		filter : $.grep,
		every : function(obj, test) {
			var result = true;
			if (!obj) {
				return result;
			}
			$.each(obj, function(key, val) {
				if (!(result = test.call(null, val, key, obj))) {
					return false;
				}
			});
			return !!result;
		},
		some : function(obj, test) {
			var result = false;
			if (!obj) {
				return result;
			}
			$.each(obj, function(key, val) {
				if (result = test.call(null, val, key, obj)) {
					return false;
				}
			});
			return !!result;
		},
		mixin : $.extend,
		getUniqueId : function() {
			var counter = 0;
			return function() {
				return counter++;
			};
		}(),
		defer : function(fn) {
			setTimeout(fn, 0);
		},
		debounce : function(func, wait, immediate) {
			var timeout, result;
			return function() {
				var context = this, args = arguments, later, callNow;
				later = function() {
					timeout = null;
					if (!immediate) {
						result = func.apply(context, args);
					}
				};
				callNow = immediate && !timeout;
				clearTimeout(timeout);
				timeout = setTimeout(later, wait);
				if (callNow) {
					result = func.apply(context, args);
				}
				return result;
			};
		},
		throttle : function(func, wait) {
			var context, args, timeout, result, previous, later;
			previous = 0;
			later = function() {
				previous = new Date();
				timeout = null;
				result = func.apply(context, args);
			};
			return function() {
				var now = new Date(), remaining = wait - (now - previous);
				context = this;
				args = arguments;
				if (remaining <= 0) {
					clearTimeout(timeout);
					timeout = null;
					previous = now;
					result = func.apply(context, args);
				} else if (!timeout) {
					timeout = setTimeout(later, remaining);
				}
				return result;
			};
		},
		tokenizeQuery : function(str) {
			return $.trim(str).toLowerCase().split(/[\s]+/);
		},
		tokenizeText : function(str) {
			return $.trim(str).toLowerCase().split(/[\s\-_]+/);
		},
		getProtocol : function() {
			return location.protocol;
		},
		noop : function() {
		}
	};
	var EventTarget = function() {
		var eventSplitter = /\s+/;
		return {
			on : function(events, callback) {
				var event;
				if (!callback) {
					return this;
				}
				this._callbacks = this._callbacks || {};
				events = events.split(eventSplitter);
				while (event = events.shift()) {
					this._callbacks[event] = this._callbacks[event] || [];
					this._callbacks[event].push(callback);
				}
				return this;
			},
			trigger : function(events, data) {
				var event, callbacks;
				if (!this._callbacks) {
					return this;
				}
				events = events.split(eventSplitter);
				while (event = events.shift()) {
					if (callbacks = this._callbacks[event]) {
						for ( var i = 0; i < callbacks.length; i += 1) {
							callbacks[i].call(this, {
								type : event,
								data : data
							});
						}
					}
				}
				return this;
			}
		};
	}();
	var EventBus = function() {
		var namespace = "typeahead:";
		function EventBus(o) {
			if (!o || !o.el) {
				$.error("EventBus initialized without el");
			}
			this.$el = $(o.el);
		}
		utils.mixin(EventBus.prototype, {
			trigger : function(type) {
				var args = [].slice.call(arguments, 1);
				this.$el.trigger(namespace + type, args);
			}
		});
		return EventBus;
	}();
	var PersistentStorage = function() {
		var ls, methods;
		try {
			ls = window.localStorage;
			ls.setItem("~~~", "!");
			ls.removeItem("~~~");
		} catch (err) {
			ls = null;
		}
		function PersistentStorage(namespace) {
			this.prefix = [ "__", namespace, "__" ].join("");
			this.ttlKey = "__ttl__";
			this.keyMatcher = new RegExp("^" + this.prefix);
		}
		if (ls && window.JSON) {
			methods = {
				_prefix : function(key) {
					return this.prefix + key;
				},
				_ttlKey : function(key) {
					return this._prefix(key) + this.ttlKey;
				},
				get : function(key) {
					if (this.isExpired(key)) {
						this.remove(key);
					}
					return decode(ls.getItem(this._prefix(key)));
				},
				set : function(key, val, ttl) {
					if (utils.isNumber(ttl)) {
						ls.setItem(this._ttlKey(key), encode(now() + ttl));
					} else {
						ls.removeItem(this._ttlKey(key));
					}
					return ls.setItem(this._prefix(key), encode(val));
				},
				remove : function(key) {
					ls.removeItem(this._ttlKey(key));
					ls.removeItem(this._prefix(key));
					return this;
				},
				clear : function() {
					var i, key, keys = [], len = ls.length;
					for (i = 0; i < len; i++) {
						if ((key = ls.key(i)).match(this.keyMatcher)) {
							keys.push(key.replace(this.keyMatcher, ""));
						}
					}
					for (i = keys.length; i--;) {
						this.remove(keys[i]);
					}
					return this;
				},
				isExpired : function(key) {
					var ttl = decode(ls.getItem(this._ttlKey(key)));
					return utils.isNumber(ttl) && now() > ttl ? true : false;
				}
			};
		} else {
			methods = {
				get : utils.noop,
				set : utils.noop,
				remove : utils.noop,
				clear : utils.noop,
				isExpired : utils.noop
			};
		}
		utils.mixin(PersistentStorage.prototype, methods);
		return PersistentStorage;
		function now() {
			return new Date().getTime();
		}
		function encode(val) {
			return JSON.stringify(utils.isUndefined(val) ? null : val);
		}
		function decode(val) {
			return JSON.parse(val);
		}
	}();
	var RequestCache = function() {
		function RequestCache(o) {
			utils.bindAll(this);
			o = o || {};
			this.sizeLimit = o.sizeLimit || 10;
			this.cache = {};
			this.cachedKeysByAge = [];
		}
		utils.mixin(RequestCache.prototype, {
			get : function(url) {
				return this.cache[url];
			},
			set : function(url, resp) {
				var requestToEvict;
				if (this.cachedKeysByAge.length === this.sizeLimit) {
					requestToEvict = this.cachedKeysByAge.shift();
					delete this.cache[requestToEvict];
				}
				this.cache[url] = resp;
				this.cachedKeysByAge.push(url);
			}
		});
		return RequestCache;
	}();
	var Transport = function() {
		var pendingRequestsCount = 0, pendingRequests = {}, maxPendingRequests, requestCache;
		function Transport(o) {
			utils.bindAll(this);
			o = utils.isString(o) ? {
				url : o
			} : o;
			requestCache = requestCache || new RequestCache();
			maxPendingRequests = utils.isNumber(o.maxParallelRequests) ? o.maxParallelRequests
					: maxPendingRequests || 6;
			this.url = o.url;
			this.wildcard = o.wildcard || "%QUERY";
			this.filter = o.filter;
			this.replace = o.replace;
			this.ajaxSettings = {
				type : "get",
				cache : o.cache,
				timeout : o.timeout,
				dataType : o.dataType || "json",
				beforeSend : o.beforeSend
			};
			this._get = (/^throttle$/i.test(o.rateLimitFn) ? utils.throttle
					: utils.debounce)(this._get, o.rateLimitWait || 300);
		}
		utils
				.mixin(
						Transport.prototype,
						{
							_get : function(url, cb) {
								var that = this;
								if (belowPendingRequestsThreshold()) {
									this._sendRequest(url).done(done);
								} else {
									this.onDeckRequestArgs = [].slice.call(
											arguments, 0);
								}
								function done(resp) {
									var data = that.filter ? that.filter(resp)
											: resp;
									cb && cb(data);
									requestCache.set(url, resp);
								}
							},
							_sendRequest : function(url) {
								var that = this, jqXhr = pendingRequests[url];
								if (!jqXhr) {
									incrementPendingRequests();
									jqXhr = pendingRequests[url] = $.ajax(url,
											this.ajaxSettings).always(always);
								}
								return jqXhr;
								function always() {
									decrementPendingRequests();
									pendingRequests[url] = null;
									if (that.onDeckRequestArgs) {
										that._get.apply(that,
												that.onDeckRequestArgs);
										that.onDeckRequestArgs = null;
									}
								}
							},
							get : function(query, cb) {
								var that = this, encodedQuery = encodeURIComponent(query
										|| ""), url, resp;
								cb = cb || utils.noop;
								url = this.replace ? this.replace(this.url,
										encodedQuery) : this.url.replace(
										this.wildcard, encodedQuery);
								if (resp = requestCache.get(url)) {
									utils.defer(function() {
										cb(that.filter ? that.filter(resp)
												: resp);
									});
								} else {
									this._get(url, cb);
								}
								return !!resp;
							}
						});
		return Transport;
		function incrementPendingRequests() {
			pendingRequestsCount++;
		}
		function decrementPendingRequests() {
			pendingRequestsCount--;
		}
		function belowPendingRequestsThreshold() {
			return pendingRequestsCount < maxPendingRequests;
		}
	}();
	var Dataset = function() {
		var keys = {
			thumbprint : "thumbprint",
			protocol : "protocol",
			itemHash : "itemHash",
			adjacencyList : "adjacencyList"
		};
		function Dataset(o) {
			utils.bindAll(this);
			if (utils.isString(o.template) && !o.engine) {
				$.error("no template engine specified");
			}
			if (!o.local && !o.prefetch && !o.remote) {
				$.error("one of local, prefetch, or remote is required");
			}
			this.name = o.name || utils.getUniqueId();
			this.limit = o.limit || 5;
			this.minLength = o.minLength || 1;
			this.header = o.header;
			this.footer = o.footer;
			this.valueKey = o.valueKey || "value";
			this.template = compileTemplate(o.template, o.engine, this.valueKey);
			this.local = o.local;
			this.prefetch = o.prefetch;
			this.remote = o.remote;
			this.itemHash = {};
			this.adjacencyList = {};
			this.storage = o.name ? new PersistentStorage(o.name) : null;
			//tag shit
			this.prefilled = o.prefilled || new Array();
			this.CapitalizeFirstLetter = o.CapitalizeFirstLetter ||  false;
			this.delimiters = o.delimiters || [ 9, 13, 44 ]; // tab, enter, comma
			this.backspace = o.backspace || [ 8 ];
			
			this.maxTags = o.maxTags || 0;
			this.deleteTagsOnBackspace = o.deleteTagsOnBackspace || true; // deprecated
			this.tagsContainer = o.tagsContainer || null;
			this.tagCloseIcon = o.tagCloseIcon || '×';
			this.tagClass = o.tagClass ||  '';
			this.validator = o.validator || null;
			this.onlyTagList = o.onlyTagList || false;
			this.AjaxPush = o.AjaxPush || null;
		}
		utils
				.mixin(
						Dataset.prototype,
						{
							_processLocalData : function(data) {
								this._mergeProcessedData(this
										._processData(data));
							},
							_loadPrefetchData : function(o) {
								var that = this, thumbprint = VERSION
										+ (o.thumbprint || ""), storedThumbprint, storedProtocol, storedItemHash, storedAdjacencyList, isExpired, deferred;
								if (this.storage) {
									storedThumbprint = this.storage
											.get(keys.thumbprint);
									storedProtocol = this.storage
											.get(keys.protocol);
									storedItemHash = this.storage
											.get(keys.itemHash);
									storedAdjacencyList = this.storage
											.get(keys.adjacencyList);
								}
								isExpired = storedThumbprint !== thumbprint
										|| storedProtocol !== utils
												.getProtocol();
								o = utils.isString(o) ? {
									url : o
								} : o;
								o.ttl = utils.isNumber(o.ttl) ? o.ttl
										: 24 * 60 * 60 * 1e3;
								if (storedItemHash && storedAdjacencyList
										&& !isExpired) {
									this._mergeProcessedData({
										itemHash : storedItemHash,
										adjacencyList : storedAdjacencyList
									});
									deferred = $.Deferred().resolve();
								} else {
									deferred = $.getJSON(o.url).done(
											processPrefetchData);
								}
								return deferred;
								function processPrefetchData(data) {
									var filteredData = o.filter ? o
											.filter(data) : data, processedData = that
											._processData(filteredData), itemHash = processedData.itemHash, adjacencyList = processedData.adjacencyList;
									if (that.storage) {
										that.storage.set(keys.itemHash,
												itemHash, o.ttl);
										that.storage.set(keys.adjacencyList,
												adjacencyList, o.ttl);
										that.storage.set(keys.thumbprint,
												thumbprint, o.ttl);
										that.storage.set(keys.protocol, utils
												.getProtocol(), o.ttl);
									}
									that._mergeProcessedData(processedData);
								}
							},
							_transformDatum : function(datum) {
								var value = utils.isString(datum) ? datum
										: datum[this.valueKey], tokens = datum.tokens
										|| utils.tokenizeText(value), item = {
									value : value,
									tokens : tokens
								};
								if (utils.isString(datum)) {
									item.datum = {};
									item.datum[this.valueKey] = datum;
								} else {
									item.datum = datum;
								}
								item.tokens = utils.filter(item.tokens,
										function(token) {
											return !utils.isBlankString(token);
										});
								item.tokens = utils.map(item.tokens, function(
										token) {
									return token.toLowerCase();
								});
								return item;
							},
							_processData : function(data) {
								var that = this, itemHash = {}, adjacencyList = {};
								utils
										.each(
												data,
												function(i, datum) {
													var item = that
															._transformDatum(datum), id = utils
															.getUniqueId(item.value);
													itemHash[id] = item;
													utils
															.each(
																	item.tokens,
																	function(i,
																			token) {
																		var character = token
																				.charAt(0), adjacency = adjacencyList[character]
																				|| (adjacencyList[character] = [ id ]);
																		!~utils
																				.indexOf(
																						adjacency,
																						id)
																				&& adjacency
																						.push(id);
																	});
												});
								return {
									itemHash : itemHash,
									adjacencyList : adjacencyList
								};
							},
							_mergeProcessedData : function(processedData) {
								var that = this;
								utils.mixin(this.itemHash,
										processedData.itemHash);
								utils
										.each(
												processedData.adjacencyList,
												function(character, adjacency) {
													var masterAdjacency = that.adjacencyList[character];
													that.adjacencyList[character] = masterAdjacency ? masterAdjacency
															.concat(adjacency)
															: adjacency;
												});
							},
							_getLocalSuggestions : function(terms) {
								var that = this, firstChars = [], lists = [], shortestList, suggestions = [];
								utils.each(terms, function(i, term) {
									var firstChar = term.charAt(0);
									!~utils.indexOf(firstChars, firstChar)
											&& firstChars.push(firstChar);
								});
								utils
										.each(
												firstChars,
												function(i, firstChar) {
													var list = that.adjacencyList[firstChar];
													if (!list) {
														return false;
													}
													lists.push(list);
													if (!shortestList
															|| list.length < shortestList.length) {
														shortestList = list;
													}
												});
								if (lists.length < firstChars.length) {
									return [];
								}
								utils
										.each(
												shortestList,
												function(i, id) {
													var item = that.itemHash[id], isCandidate, isMatch;
													isCandidate = utils
															.every(
																	lists,
																	function(
																			list) {
																		return ~utils
																				.indexOf(
																						list,
																						id);
																	});
													isMatch = isCandidate
															&& utils
																	.every(
																			terms,
																			function(
																					term) {
																				return utils
																						.some(
																								item.tokens,
																								function(
																										token) {
																									return token
																											.indexOf(term) === 0;
																								});
																			});
													isMatch
															&& suggestions
																	.push(item);
												});
								return suggestions;
							},
							initialize : function() {
								var deferred;
								this.local
										&& this._processLocalData(this.local);
								this.transport = this.remote ? new Transport(
										this.remote) : null;
								deferred = this.prefetch ? this
										._loadPrefetchData(this.prefetch) : $
										.Deferred().resolve();
								this.local = this.prefetch = this.remote = null;
								this.initialize = function() {
									return deferred;
								};
								return deferred;
							},
							getSuggestions : function(query, cb) {
								var that = this, terms, suggestions, cacheHit = false;
								if (query.length < this.minLength) {
									return;
								}
								terms = utils.tokenizeQuery(query);
								suggestions = this._getLocalSuggestions(terms)
										.slice(0, this.limit);
								//var t = that._transformDatum("blah"),isDuplicate;
								//t.value = "bleh";
								//suggestions.push(t);
								if (suggestions.length < this.limit
										&& this.transport) {
									cacheHit = this.transport.get(query,
											processRemoteData);
								}
								!cacheHit && cb && cb(suggestions);
								function processRemoteData(data) {
									suggestions = suggestions.slice(0);
									utils
											.each(
													data,
													function(i, datum) {
														var item = that
																._transformDatum(datum), isDuplicate;
														isDuplicate = utils
																.some(
																		suggestions,
																		function(
																				suggestion) {
																			return item.value === suggestion.value;
																		});
														!isDuplicate
																&& suggestions
																		.push(item);
														return suggestions.length < that.limit;
													});
									cb && cb(suggestions);
								}
							}
						});
		return Dataset;
		function compileTemplate(template, engine, valueKey) {
			var renderFn, compiledTemplate;
			if (utils.isFunction(template)) {
				renderFn = template;
			} else if (utils.isString(template)) {
				compiledTemplate = engine.compile(template);
				renderFn = utils
						.bind(compiledTemplate.render, compiledTemplate);
			} else {
				renderFn = function(context) {
					return "<p>" + context[valueKey] + "</p>";
				};
			}
			return renderFn;
		}
	}();
	var InputView = function() {
		function InputView(o) {
			var that = this;
			utils.bindAll(this);
			this.specialKeyCodeMap = {
				9 : "tab",
				27 : "esc",
				37 : "left",
				39 : "right",
				13 : "enter",
				38 : "up",
				40 : "down",
				8  : "backspace"
			};
			this.$hint = $(o.hint);
			this.$input = $(o.input).on("blur.tt", this._handleBlur).on(
					"focus.tt", this._handleFocus).on("keydown.tt",
					this._handleSpecialKeyEvent);
			if (!utils.isMsie()) {
				
				this.$input.on("input.tt", this._compareQueryToInputValue);
			} else {
				
				this.$input
						.on(
								"keydown.tt keypress.tt cut.tt paste.tt",
								function($e) {
									
									if (that.specialKeyCodeMap[$e.which
											|| $e.keyCode]) {
										return;
									}
									utils.defer(that._compareQueryToInputValue);
								});
			}
			this.query = this.$input.val();
			this.$overflowHelper = buildOverflowHelper(this.$input);
		}
		utils
				.mixin(
						InputView.prototype,
						EventTarget,
						{
							_handleFocus : function() {
								this.trigger("focused");
							},
							_handleBlur : function() {
								this.trigger("blured");
							},
							_handleSpecialKeyEvent : function($e) {

								var keyName = this.specialKeyCodeMap[$e.which
										|| $e.keyCode];
								
								
								keyName && this.trigger(keyName + "Keyed", $e);
								//console.log(keyName && keyName);
							},
							_compareQueryToInputValue : function() {
								var inputValue = this.getInputValue(), isSameQuery = compareQueries(
										this.query, inputValue), isSameQueryExceptWhitespace = isSameQuery ? this.query.length !== inputValue.length
										: false;
								if (isSameQueryExceptWhitespace) {
									this.trigger("whitespaceChanged", {
										value : this.query
									});
								} else if (!isSameQuery) {
									this.trigger("queryChanged", {
										value : this.query = inputValue
									});
								}
							},
							destroy : function() {
								this.$hint.off(".tt");
								this.$input.off(".tt");
								this.$hint = this.$input = this.$overflowHelper = null;
							},
							focus : function() {
								this.$input.focus();
							},
							blur : function() {
								this.$input.blur();
							},
							getQuery : function() {
								return this.query;
							},
							setQuery : function(query) {
								this.query = query;
							},

							getInputValue : function() {
								return this.$input.val();
							},
							setInputValue : function(value, silent) {
								
								this.$input.val(value);
								!silent && this._compareQueryToInputValue();
							},
							getHintValue : function() {
								return this.$hint.val();
							},
							setHintValue : function(value) {
								this.$hint.val(value);
							},
							getLanguageDirection : function() {
								return (this.$input.css("direction") || "ltr")
										.toLowerCase();
							},
							isOverflow : function() {
								this.$overflowHelper.text(this.getInputValue());
								return this.$overflowHelper.width() > this.$input
										.width();
							},
							isCursorAtEnd : function() {
								var valueLength = this.$input.val().length, selectionStart = this.$input[0].selectionStart, range;
								if (utils.isNumber(selectionStart)) {
									return selectionStart === valueLength;
								} else if (document.selection) {
									range = document.selection.createRange();
									range.moveStart("character", -valueLength);
									return valueLength === range.text.length;
								}
								return true;
							}
						});
		return InputView;
		function buildOverflowHelper($input) {
			return $("<span></span>").css({
				position : "absolute",
				left : "-9999px",
				visibility : "hidden",
				whiteSpace : "nowrap",
				fontFamily : $input.css("font-family"),
				fontSize : $input.css("font-size"),
				fontStyle : $input.css("font-style"),
				fontVariant : $input.css("font-variant"),
				fontWeight : $input.css("font-weight"),
				wordSpacing : $input.css("word-spacing"),
				letterSpacing : $input.css("letter-spacing"),
				textIndent : $input.css("text-indent"),
				textRendering : $input.css("text-rendering"),
				textTransform : $input.css("text-transform")
			}).insertAfter($input);
		}
		function compareQueries(a, b) {
			a = (a || "").replace(/^\s*/g, "").replace(/\s{2,}/g, " ");
			b = (b || "").replace(/^\s*/g, "").replace(/\s{2,}/g, " ");
			return a === b;
		}
	}();
	var DropdownView = function() {
		var html = {
			suggestionsList : '<span class="tt-suggestions"></span>'
		}, css = {
			suggestionsList : {
				display : "block"
			},
			suggestion : {
				whiteSpace : "nowrap",
				cursor : "pointer"
			},
			suggestionChild : {
				whiteSpace : "normal"
			}
		};
		function DropdownView(o) {
			utils.bindAll(this);
			this.isOpen = false;
			this.isEmpty = true;
			this.isMouseOverDropdown = false;
			this.$menu = $(o.menu).on("mouseenter.tt", this._handleMouseenter)
					.on("mouseleave.tt", this._handleMouseleave).on("click.tt",
							".tt-suggestion", this._handleSelection).on(
							"mouseover.tt", ".tt-suggestion",
							this._handleMouseover);
		}
		utils
				.mixin(
						DropdownView.prototype,
						EventTarget,
						{
							_handleMouseenter : function() {
								this.isMouseOverDropdown = true;
							},
							_handleMouseleave : function() {
								this.isMouseOverDropdown = false;
							},
							_handleMouseover : function($e) {
								var $suggestion = $($e.currentTarget);
								this._getSuggestions().removeClass(
										"tt-is-under-cursor");
								$suggestion.addClass("tt-is-under-cursor");
							},
							_handleSelection : function($e) {
								var $suggestion = $($e.currentTarget);
								// applyDelimiter($e);
								// clicking selections
								this.trigger("suggestionSelected",
										extractSuggestion($suggestion));
							},
							_show : function() {
								this.$menu.css("display", "block");
							},
							_hide : function() {
								this.$menu.hide();
							},
							_moveCursor : function(increment) {
								var $suggestions, $cur, nextIndex, $underCursor;
								if (!this.isVisible()) {
									return;
								}
								$suggestions = this._getSuggestions();
								
								$cur = $suggestions
										.filter(".tt-is-under-cursor");
								$cur.removeClass("tt-is-under-cursor");
								nextIndex = $suggestions.index($cur)
										+ increment;
								nextIndex = (nextIndex + 1)
										% ($suggestions.length + 1) - 1;
								if (nextIndex === -1) {
									this.trigger("cursorRemoved");
									return;
								} else if (nextIndex < -1) {
									nextIndex = $suggestions.length - 1;
								}
								$underCursor = $suggestions.eq(nextIndex)
										.addClass("tt-is-under-cursor");
								this._ensureVisibility($underCursor);
								this.trigger("cursorMoved",
										extractSuggestion($underCursor));
							},
							_getSuggestions : function() {
								return this.$menu
										.find(".tt-suggestions > .tt-suggestion");
							},
							_ensureVisibility : function($el) {
								var menuHeight = this.$menu.height()
										+ parseInt(
												this.$menu.css("paddingTop"),
												10)
										+ parseInt(this.$menu
												.css("paddingBottom"), 10), menuScrollTop = this.$menu
										.scrollTop(), elTop = $el.position().top, elBottom = elTop
										+ $el.outerHeight(true);
								if (elTop < 0) {
									this.$menu.scrollTop(menuScrollTop + elTop);
								} else if (menuHeight < elBottom) {
									this.$menu.scrollTop(menuScrollTop
											+ (elBottom - menuHeight));
								}
							},
							destroy : function() {
								this.$menu.off(".tt");
								this.$menu = null;
							},
							isVisible : function() {
								return this.isOpen && !this.isEmpty;
							},
							closeUnlessMouseIsOverDropdown : function() {
								if (!this.isMouseOverDropdown) {
									this.close();
								}
							},
							close : function() {
								if (this.isOpen) {
									this.isOpen = false;
									this.isMouseOverDropdown = false;
									this._hide();
									this.$menu.find(
											".tt-suggestions > .tt-suggestion")
											.removeClass("tt-is-under-cursor");
									this.trigger("closed");
								}
							},
							open : function() {
								if (!this.isOpen) {
									this.isOpen = true;
									!this.isEmpty && this._show();
									this.trigger("opened");
								}
							},
							setLanguageDirection : function(dir) {
								var ltrCss = {
									left : "0",
									right : "auto"
								}, rtlCss = {
									left : "auto",
									right : " 0"
								};
								dir === "ltr" ? this.$menu.css(ltrCss)
										: this.$menu.css(rtlCss);
							},
							moveCursorUp : function() {
								this._moveCursor(-1);
							},
							moveCursorDown : function() {
								this._moveCursor(+1);
							},
							getSuggestionUnderCursor : function() {
								var $suggestion = this._getSuggestions()
										.filter(".tt-is-under-cursor").first();
								return $suggestion.length > 0 ? extractSuggestion($suggestion)
										: null;
							},
							getFirstSuggestion : function() {
								var $suggestion = this._getSuggestions()
										.first();
								return $suggestion.length > 0 ? extractSuggestion($suggestion)
										: null;
							},
							renderSuggestions : function(dataset, suggestions) {
								var datasetClassName = "tt-dataset-"
										+ dataset.name, wrapper = '<div class="tt-suggestion">%body</div>', compiledHtml, $suggestionsList, $dataset = this.$menu
										.find("." + datasetClassName), elBuilder, fragment, $el;
								if ($dataset.length === 0) {
									$suggestionsList = $(html.suggestionsList)
											.css(css.suggestionsList);
									$dataset = $("<div></div>").addClass(
											datasetClassName).append(
											dataset.header).append(
											$suggestionsList).append(
											dataset.footer)
											.appendTo(this.$menu);
								}
								if (suggestions.length > 0) {

									
									this.isEmpty = false;
									this.isOpen && this._show();
									elBuilder = document.createElement("div");
									fragment = document
											.createDocumentFragment();
									utils.each(suggestions, function(i,
											suggestion) {
										suggestion.dataset = dataset.name;
										compiledHtml = dataset
												.template(suggestion.datum);
										elBuilder.innerHTML = wrapper.replace(
												"%body", compiledHtml);
										$el = $(elBuilder.firstChild).css(
												css.suggestion).data(
												"suggestion", suggestion);
										$el.children().each(function() {
											$(this).css(css.suggestionChild);
										});
										fragment.appendChild($el[0]);
									});
									$dataset.show().find(".tt-suggestions")
											.html(fragment);
								} else {
									this.clearSuggestions(dataset.name);
								}
								this.trigger("suggestionsRendered");
							},
							clearSuggestions : function(datasetName) {
								var $datasets = datasetName ? this.$menu
										.find(".tt-dataset-" + datasetName)
										: this.$menu
												.find('[class^="tt-dataset-"]'), $suggestions = $datasets
										.find(".tt-suggestions");
								$datasets.hide();
								$suggestions.empty();
								if (this._getSuggestions().length === 0) {
									this.isEmpty = true;
									this._hide();
								}
							}
						});
		return DropdownView;
		function extractSuggestion($el) {
			return $el.data("suggestion");
		}
	}();

	var TagView = function() {
		var that;
		//console.log(this);
		
		var keyNums = [ 9, 13, 17, 18, 19, 37, 38, 39, 40 ];
		var delimiters = [ 9, 13, 44 ];
		var delimiterChars = [], delimiterKeys = [];
		$.each(delimiters, function(i, v) {
			if ($.inArray(v, keyNums) != -1) {
				delimiterKeys.push(v);
			} else {
				delimiterChars.push(v);
			}
		});

		var tagBaseClass = 'tm-tag';
		var inputBaseClass = 'tm-input';
		var baseDelimiter = String.fromCharCode(delimiterChars[0] || 44);
		var backspace = [8];


		function TagView(o) {
			that = this;
			utils.bindAll(this);
			this.isOpen = false;
			this.isEmpty = true;
			this.isMouseOverDropdown = false;
			 this.tagManagerOptions = {
						prefilled : Array(),
						CapitalizeFirstLetter : false,
						delimiters : [ 9, 13, 44 ], // tab, enter, comma
						backspace : [ 8 ],
						maxTags : 0,
						deleteTagsOnBackspace : true, // deprecated
						tagsContainer : null,
						tagCloseIcon : '×',
						tagClass : '',
						validator : null,
						onlyTagList : false,
						AjaxPush : null

					};
				var delimiters = this.tagManagerOptions.delimeters
				|| this.tagManagerOptions.delimiters; // 'delimeter' is deprecated
		// delimiter values to be handled as key codes
				if ($.isFunction(this.tagManagerOptions.validator))
					obj.data('validator', this.tagManagerOptions.validator);
			//console.log("options");
			//console.log(o.options);
			this.highlightedTag = null;
			//this.tagManagerOptions = o.options;
			$.extend(this.tagManagerOptions, o.options[0]);
			
			this.tagList = new Array();
			this.tagIdList = new Array();
			this.obj = $(o.input);
			this.tagBaseClass = 'tm-tag';
			this.inputBaseClass = 'tm-input';
			this.objName = this.obj.attr('name').replace(/[^\w]/g, '_');
			//console.log(this.objName);
			if ($.isFunction(this.tagManagerOptions.validator)) this.obj.data('validator', this.tagManagerOptions.validator);
		    if (this.tagManagerOptions.prefilled != null) {
		        if (typeof (this.tagManagerOptions.prefilled) == "object") {


		          this.prefill(this.tagManagerOptions.prefilled);
		        } else if (typeof (this.tagManagerOptions.prefilled) == "string") {
		          this.prefill(this.tagManagerOptions.prefilled.split(baseDelimiter));
		        } else if (typeof (this.tagManagerOptions.prefilled) == "function") {
		          this.prefill(this.tagManagerOptions.prefilled());
		        }
		      }
		    
			// this.$menu = $(o.menu).on("mouseenter.tt",
			// this._handleMouseenter).on("mouseleave.tt",
			// this._handleMouseleave).on("click.tt", ".tt-suggestion",
			// this._handleSelection).on("mouseover.tt", ".tt-suggestion",
			// this._handleMouseover);
		}
		utils.mixin(TagView.prototype, EventTarget, {
			_handleMouseenter : function() {
				this.isMouseOverTag = true;
			},
			_handleMouseleave : function() {
				this.isMouseOverTag = false;
			},
			_handleMouseover : function($e) {
				var $tag = $($e.currentTarget);
				// this._getSuggestions().removeClass("tt-is-under-cursor");
				// $suggestion.addClass("tt-is-under-cursor");
			},
			_handleSelection : function($e) {
				var $suggestion = $($e.currentTarget);
				// applyDelimiter($e);

				this.trigger("tagSelected", extractSuggestion($suggestion));
			},
			_show : function() {
			},
			_hide : function() {
			},
			_moveCursor : function(increment) {

			},
			_getTags : function() {
			},

			destroy : function() {

			},
			isVisible : function() {
				return this.isOpen && !this.isEmpty;
			},

			close : function() {
				if (this.isOpen) {
					this.isOpen = false;
					this._hide();
					this.trigger("closed");
				}
			},

			renderTags : function(dataset, tags) {

				if (tags.length > 0) {
				}

			},

			applyDelimiter : function(tag, $e) {
				// var taItem = $($e.currentTarget);
				//console.log(tag.value);
				this.pushTag(tag);
				// var taVisible = typeaheadVisible();
				// if (!(e.which==13 && taItem && taVisible)) {
				// pushTag(obj.val());
				// }
				// $e.preventDefault();
			},
			clearTags : function(datasetName) {
				var tlis = obj.data("tlis");
				var tlid = obj.data("tlid");

				while (tlid.length > 0) {
					var tagId = tlid.pop();
					tlis.pop();
					// console.log("TagIdToRemove: " + tagId);
					$("#" + objName + "_" + tagId).remove();
					refreshHiddenTagList();
					// console.log(tlis);
				}
			},
			pushTag : function(tag) {
				//console.log(this.objName);
				//console.log(tag);
				tag.value = trimTag(tag.value);
				console.log(tag.value);
				//console.log(tag);
				if (!tag || tag.length <= 0)
					return;
				
				if (this.tagManagerOptions.CapitalizeFirstLetter && tag.value.length > 1) {
					tag.value = tag.value.charAt(0).toUpperCase()
							+ tag.value.slice(1).toLowerCase();
				}

				// call the validator (if any) and do not let the tag pass if
				// invalid
				if (this.obj.data('validator') && !this.obj.data('validator')(tag))
				 return;

				var tlis = this.tagList;
				var tlid = this.tagIdList;
				// var tlid = obj.data("tlid");

				// dont accept new tags beyond the defined maximum
				if (this.tagManagerOptions.maxTags > 0
						&& tlis.length >= this.tagManagerOptions.maxTags){
					console.log(this.obj);
					return;
			}
				var alreadyInList = false;
				var tlisLowerCase = tlis.map(function(elem) {
					//console.log(elem);
					return elem.value.toLowerCase();
				});
				var p = $.inArray(tag.value.toLowerCase(), tlisLowerCase);
				if (-1 != p) {
					 console.log("tag:" + tag + " !!already in list!!");
					alreadyInList = true;
				}

				if (alreadyInList) {
					// var pTagId = tlid[p];
					
					// $("#" + this.objName + "_" + pTagId).stop().animate({
					// 	backgroundColor : this.tagManagerOptions.blinkBGColor_1
					// }, 100).animate({
					// 	backgroundColor : this.tagManagerOptions.blinkBGColor_2
					// }, 100).animate({
					// 	backgroundColor : this.tagManagerOptions.blinkBGColor_1
					// }, 100).animate({
					// 	backgroundColor : this.tagManagerOptions.blinkBGColor_2
					// }, 100).animate({
					// 	backgroundColor : this.tagManagerOptions.blinkBGColor_1
					// }, 100).animate({
					// 	backgroundColor : this.tagManagerOptions.blinkBGColor_2
					// }, 100);
				} else {
					var max = Math.max.apply(null, tlid);
					max = max == -Infinity ? 0 : max;

					var tagId = ++max;
					tlis.push(tag);
					tlid.push(tagId);

					if (this.tagManagerOptions.AjaxPush != null) {
						$.post(this.tagManagerOptions.AjaxPush, $.extend({
							tag : tag
						}, this.tagManagerOptions.AjaxPushParameters));
					}

					// console.log("tagList: " + tlis);

					var newTagId = this.objName + '_' + tagId;

					var newTagRemoveId = this.objName + '_Remover_' + tagId;
					console.log(tag.value);
					var escaped = $("<span></span>").text(tag.value).html();
					console.log(tag);
					var html = '<span class="' + this.tagClasses() + '" id="'
							+ newTagId + '">';
					html += '<span>' + escaped + '</span>';
					html += '<a href="#" class="tm-tag-remove" id="'
							+ newTagRemoveId + '" TagIdToRemove="' + tagId
							+ '">';
					html += this.tagManagerOptions.tagCloseIcon + '</a></span> ';
					var $el = $(html);

					if (this.tagManagerOptions.tagsContainer != null) {
						$(this.tagManagerOptions.tagsContainer).append($el);
					} else {
						// $('html').append($el);
						$el.hide();
						this.obj.parent().before($el);
						$el.show("fast");
						
						
					}

					$el.find("#" + newTagRemoveId)
							.on(
									"click",
									{
										"tagView" : this
									},
									function(e) {
										e.preventDefault();
										var TagIdToRemove = parseInt($(this)
												.attr("TagIdToRemove"));
										e.data.tagView.spliceTag(TagIdToRemove,
												e.data);
									});

					// refreshHiddenTagList();

					if (this.tagManagerOptions.maxTags > 0
							&& tlis.length >= this.tagManagerOptions.maxTags) {
						// obj.hide();
					}
				}
				// obj.val("");
			},

			tagClasses : function() {
				// 1) default class (tm-tag)
				var cl = this.tagBaseClass;
				// 2) interpolate from input class: tm-input-xxx --> tm-tag-xxx
				if (this.obj.attr('class')) {

					$.each(this.obj.attr('class').split(' '), function(index,
							value) {

						if (value.indexOf(inputBaseClass + '-') != -1) {
							cl += ' ' + tagBaseClass
									+ value.substring(inputBaseClass.length);

						}
					});
				}
				// 3) tags from tagClass option
				cl += (this.tagManagerOptions.tagClass ? ' '
						+ this.tagManagerOptions.tagClass : '');
				return cl;
			},
			popTag : function() {

				if(this.highlightedTag != null){
					var tagId = this.tagIdList[this.highlightedTag];
					this.spliceTag(tagId);
					this.highlightLeftTag();
				}
				
				else if (this.tagIdList.length > 0) {
					var tagId = this.tagIdList.pop();
					//this.tagIdList.pop();
					this.tagList.pop();
					// console.log("TagIdToRemove: " + tagId);
					var rem = $("#" + this.objName + "_" + tagId);
					rem.hide('fast', function(){ rem.remove(); }); 
					// refreshHiddenTagList();
					// console.log(tlis);
				}
			},
			highlightLeftTag : function() {

				if (this.tagIdList.length > 0) {
					//var tagId = this.tagIdList.pop();
					//this.tagList.pop();
					//console.log(this.highlightedTag);
					if(this.highlightedTag==null){
						this.highlightedTag = this.tagIdList.length - 1;
					}
					else if(this.highlightedTag == 0){
						var tagId = this.tagIdList[this.highlightedTag];

						var rem = $("#" + this.objName + "_" + tagId);
						rem.removeClass("tm-tag-active");
						this.highlightedTag = null;
						this.obj.flash("0,191,255", 1000);;

						return;
					}
					else{
						this.highlightedTag = this.highlightedTag - 1;
					}
					var tagId = this.tagIdList[this.highlightedTag];
					if(this.highlightedTag==null){
						var prev =  $("#" + this.objName + "_" +  this.tagIdList[this.highlightedTag+1]);
						prev.removeClass("tm-tag-active");

					}
					
					var rem = $("#" + this.objName + "_" + tagId);
					var prev =  $("#" + this.objName + "_" +  this.tagIdList[this.highlightedTag+1]);
					rem.addClass("tm-tag-active");
					prev.removeClass("tm-tag-active");
					
					// refreshHiddenTagList();
					// console.log(tlis);
				}
			},
			highlightRightTag : function() {

				if (this.tagIdList.length > 0) {
					//var tagId = this.tagIdList.pop();
					//this.tagList.pop();
					//console.log(this.highlightedTag);
					if(this.highlightedTag==null){
						//this.highlightedTag = this.tagIdList.length - 1;
					}
					else if(this.highlightedTag == this.tagIdList.length - 1){
						var tagId = this.tagIdList[this.highlightedTag];

						var rem = $("#" + this.objName + "_" + tagId);
						rem.removeClass("tm-tag-active");
						this.highlightedTag = null;


						return;
					}
					else{
						this.highlightedTag = this.highlightedTag + 1;
					}
					var tagId = this.tagIdList[this.highlightedTag];
//					if(this.highlightedTag==null){
//						var prev =  $("#" + this.objName + "_" +  this.tagIdList[this.highlightedTag-1]);
//						prev.removeClass("tm-tag-active");
//
//					}
					
					var rem = $("#" + this.objName + "_" + tagId);
					var prev =  $("#" + this.objName + "_" +  this.tagIdList[this.highlightedTag-1]);
					rem.addClass("tm-tag-active");
					prev.removeClass("tm-tag-active");
					
					// refreshHiddenTagList();
					// console.log(tlis);
				}
			},	


			spliceTag : function(tagId) {
				var tlid = this.tagIdList;
				;

				var p = $.inArray(tagId, tlid);

				// console.log("TagIdToRemove: " + tagId);
				// console.log("position: " + p);

				if (-1 != p) {
					var rem = $("#" + this.objName + "_" + tagId);
					rem.hide('fast', function(){ rem.remove(); }); 
					this.tagList.splice(p, 1);
					tlid.splice(p, 1);
					// refreshHiddenTagList();
					// console.log(tlis);
				}

				if (this.tagManagerOptions.maxTags > 0
						&& tlis.length < this.tagManagerOptions.maxTags) {
					this.obj.show();
				}
			},
			prefill : function(pta) {
				//console.log("PTA",pta.length);
				$.each(pta, function(index) {
					//console.log("index",this);
					//console.log(index);
					//console.log(o);
					//var o = tag;

					//console.log(o.value.toLowerCase());
					//tagList.push(o);
					//console.log("value",this.value);
					that.pushTag(this);
				});
			}

		});
		var typeaheadSelectedItem = function() {
			var listItemSelector = '.'
					+ this.tagManagerOptions.typeaheadOverrides.selectedClass;
			var typeahead_data = obj.data('typeahead');
			return typeahead_data ? typeahead_data.$menu.find(listItemSelector)
					: undefined;
		};

		var typeaheadVisible = function() {
			return $('.typeahead:visible')[0];
		};
		//
		var tagClasses = function() {
			// 1) default class (tm-tag)
			var cl = tagBaseClass;
			// 2) interpolate from input class: tm-input-xxx --> tm-tag-xxx
			if (obj.attr('class')) {
				$.each(obj.attr('class').split(' '), function(index, value) {
					if (value.indexOf(inputBaseClass + '-') != -1) {
						cl += ' ' + tagBaseClass
								+ value.substring(inputBaseClass.length);
					}
				});
			}
			// 3) tags from tagClass option
			cl += (this.tagManagerOptions.tagClass ? ' '
					+ this.tagManagerOptions.tagClass : '');
			return cl;
		};

		var trimTag = function(tag) {
			tag = $.trim(tag);
			// truncate at the first delimiter char
			var i = 0;
			for (i; i < tag.length; i++) {
				if ($.inArray(tag.charCodeAt(i), delimiterChars) != -1)
					break;
			}
			return tag.substring(0, i);
		};

		var pushAllTags = function(e, tagstring) {
			if (this.tagManagerOptions.AjaxPushAllTags) {
				$.post(this.tagManagerOptions.AjaxPush, {
					tags : tagstring
				});
			}
		};



		var killEvent = function(e) {
			e.cancelBubble = true;
			e.returnValue = false;
			e.stopPropagation();
			e.preventDefault();
		};

		var keyInArray = function(e, ary) {
			return $.inArray(e.which, ary) != -1
		};

		return TagView;
		function extractTag($el) {

		}
	}();

	var TypeaheadView = function() {
		var html = {
			wrapper : '<span class="twitter-typeahead"></span>',
			hint : '<input class="tt-hint" type="text" autocomplete="off" spellcheck="off" disabled>',
			dropdown : '<span class="tt-dropdown-menu"></span>'
		}, css = {
			wrapper : {
				position : "relative",
				display : "inline-block"
			},
			hint : {
				position : "absolute",
				top : "0",
				left : "0",
				borderColor : "transparent",
				boxShadow : "none",
				//display: "none"
					
			},
			query : {
				position : "relative",
//				verticalAlign : "top",
				top : "0",
				left : "0",
				backgroundColor : "transparent",
				margin: "0"
			},
			dropdown : {
				position : "absolute",
				top : "100%",
				left : "0",
				zIndex : "100",
				display : "none"
			}
		};
		if (utils.isMsie()) {
			utils
					.mixin(
							css.query,
							{
								backgroundImage : "url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)"
							});
		}
		if (utils.isMsie() && utils.isMsie() <= 7) {
			utils.mixin(css.wrapper, {
				display : "inline",
				zoom : "1"
			});
			utils.mixin(css.query, {
				marginTop : "-1px"
			});
		}

		function TypeaheadView(o) {
			var $menu, $input, $hint, $tags,$options;
			utils.bindAll(this);
			this.$node = buildDomStructure(o.input);
			this.datasets = o.datasets;
			this.dir = null;
			this.hitRight = 0;
			this.eventBus = o.eventBus;
			$tags = this.$node.find(".tt-tags");
			$menu = this.$node.find(".tt-dropdown-menu");
			$input = this.$node.find(".tt-query");
			$hint = this.$node.find(".tt-hint");
			this.tagView = new TagView({
				tags : $tags,
				input : $input,
				options : this.datasets
				
			}).on("suggestionSelected", this._handleSelection)
			this.dropdownView = new DropdownView({
				menu : $menu
			}).on("suggestionSelected", this._handleSelection).on(
					"cursorMoved", this._clearHint).on("cursorMoved",
					this._setInputValueToSuggestionUnderCursor).on(
					"cursorRemoved", this._setInputValueToQuery).on(
					"cursorRemoved", this._updateHint).on(
					"suggestionsRendered", this._updateHint).on("opened",
					this._updateHint).on("closed", this._clearHint).on(
					"opened closed", this._propagateEvent);
			this.inputView = new InputView({
				input : $input,
				hint : $hint
			}).on("focused", this._openDropdown).on("blured",
					this._closeDropdown).on("blured",
					this._setInputValueToQuery).on("enterKeyed tabKeyed",
					this._handleSelection).on("queryChanged", this._clearHint)
					.on("queryChanged", this._clearSuggestions).on(
							"queryChanged", this._getSuggestions).on(
							"whitespaceChanged", this._updateHint).on(
							"queryChanged whitespaceChanged",
							this._openDropdown).on(
							"queryChanged whitespaceChanged",
							this._setLanguageDirection).on("escKeyed",
							this._closeDropdown).on("escKeyed",
							this._setInputValueToQuery).on(
							"tabKeyed upKeyed downKeyed",
							this._managePreventDefault).on("upKeyed downKeyed",
							this._moveDropdownCursor).on("upKeyed downKeyed",
							this._openDropdown)
					.on("tabKeyed leftKeyed rightKeyed", this._autocomplete).on("backspaceKeyed",this._removeTag).on(
							"leftKeyed", this._highlightLeftTag).on(
									"rightKeyed", this._highlightRightTag);
		}
		utils
				.mixin(
						TypeaheadView.prototype,
						EventTarget,
						{
							_managePreventDefault : function(e) {
								var $e = e.data, hint, inputValue, preventDefault = false;
								switch (e.type) {
								case "tabKeyed":
									hint = this.inputView.getHintValue();
									inputValue = this.inputView.getInputValue();
									preventDefault = hint
											&& hint !== inputValue;
									break;
								
								case "upKeyed":
								case "downKeyed":
									preventDefault = !$e.shiftKey
											&& !$e.ctrlKey && !$e.metaKey;
									break;
								}
								preventDefault && $e.preventDefault();
							},
							_setLanguageDirection : function() {
								var dir = this.inputView.getLanguageDirection();
								if (dir !== this.dir) {
									this.dir = dir;
									this.$node.css("direction", dir);
									this.dropdownView.setLanguageDirection(dir);
								}
							},
							_updateHint : function() {
								var suggestion = this.dropdownView
										.getFirstSuggestion(), hint = suggestion ? suggestion.value
										: null, dropdownIsVisible = this.dropdownView
										.isVisible(), inputHasOverflow = this.inputView
										.isOverflow(), inputValue, query, escapedQuery, beginsWithQuery, match;
								if (hint && dropdownIsVisible
										&& !inputHasOverflow) {
									inputValue = this.inputView.getInputValue();
									query = inputValue.replace(/\s{2,}/g, " ")
											.replace(/^\s+/g, "");
									escapedQuery = utils
											.escapeRegExChars(query);
									beginsWithQuery = new RegExp("^(?:"
											+ escapedQuery + ")(.*$)", "i");
									match = beginsWithQuery.exec(hint);
									this.inputView.setHintValue(inputValue
											+ (match ? match[1] : ""));
								}
							},
							_clearHint : function() {
								this.inputView.setHintValue("");
							},
							_clearSuggestions : function() {
								this.dropdownView.clearSuggestions();
							},
							_setInputValueToQuery : function() {
								this.inputView.setInputValue(this.inputView
										.getQuery());
							},
							_setInputValueToSuggestionUnderCursor : function(e) {
								var suggestion = e.data;
								this.inputView.setInputValue(suggestion.value,
										true);
							},
							_openDropdown : function() {
								this.dropdownView.open();
							},
							_closeDropdown : function(e) {
								this.dropdownView[e.type === "blured" ? "closeUnlessMouseIsOverDropdown"
										: "close"]();
							},
							_moveDropdownCursor : function(e) {
								var $e = e.data;
								if (!$e.shiftKey && !$e.ctrlKey && !$e.metaKey) {
									this.dropdownView[e.type === "upKeyed" ? "moveCursorUp"
											: "moveCursorDown"]();
								}
							},
							_handleSelection : function(e) {
								var byClick = e.type === "suggestionSelected", suggestion = byClick ? e.data
										: this.dropdownView
												.getSuggestionUnderCursor();
								if (suggestion) {
									// push tag here
									//console.log("pushing Tag");

									this.tagView.applyDelimiter(suggestion, e);
									this.inputView
											.setInputValue("");
									byClick ? this.inputView.focus() : e.data
											.preventDefault();
									byClick && utils.isMsie() ? utils
											.defer(this.dropdownView.close)
											: this.dropdownView.close();
									this.eventBus.trigger("selected",
											suggestion.datum,
											suggestion.dataset);
								}
							},

							_getSuggestions : function() {
								var that = this, query = this.inputView
										.getQuery();
								if (utils.isBlankString(query)) {
									return;
								}
								utils
										.each(
												this.datasets,
												function(i, dataset) {
													dataset
															.getSuggestions(
																	query,
																	function(
																			suggestions) {
																		
																		//check if any query is ok
																		var t = dataset._transformDatum(query),isDuplicate;
																		t.value = query;
																		suggestions.push(t);
																		if (query === that.inputView
																				.getQuery()) {
																			that.dropdownView
																					.renderSuggestions(
																							dataset,
																							suggestions);
																		}
																	});
												});
							},
							_autocomplete : function(e) {
								var isCursorAtEnd, ignoreEvent, query, hint, suggestion;
								if (e.type === "rightKeyed"
										|| e.type === "leftKeyed") {
									isCursorAtEnd = this.inputView
											.isCursorAtEnd();
									ignoreEvent = this.inputView
											.getLanguageDirection() === "ltr" ? e.type === "leftKeyed"
											: e.type === "rightKeyed";
									if (!isCursorAtEnd || ignoreEvent) {
										return;
									}
								}
								query = this.inputView.getQuery();
								hint = this.inputView.getHintValue();
								if (hint !== "" && query !== hint) {
									suggestion = this.dropdownView
											.getFirstSuggestion();
									this.inputView
											.setInputValue(suggestion.value);
									this.eventBus.trigger("autocompleted",
											suggestion.datum,
											suggestion.dataset);
								}
							},
							_propagateEvent : function(e) {
								this.eventBus.trigger(e.type);
							},
							destroy : function() {
								this.inputView.destroy();
								this.dropdownView.destroy();
								destroyDomStructure(this.$node);
								this.$node = null;
							},
							setQuery : function(query) {
								
								this.inputView.setQuery(query);
								this.inputView.setInputValue(query);
								this._clearHint();
								this._clearSuggestions();
								this._getSuggestions();
							},

							_removeTag : function(e) {
									 //console.log(this.inputView.$input);
									 debugger;
									 if (this.inputView.$input.val().length <= 0) {
										 //console.log("test");
										 this.tagView.popTag();
										 //killEvent(e);
									 }

							},
							_highlightLeftTag : function(e) {
								 //console.log(this.inputView.$input);
								//console.log(getCaretPos(this.inputView.$input.get(0)));
								 if (this.inputView.$input.val().length <= 0 || getCaretPos(this.inputView.$input.get(0)) ==0 ) {
									 
									 //console.log("test");
									 //this.tagView.popTag();
									 //killEvent(e);
									 this.tagView.highlightLeftTag();
									 
									 //console.log("ht"+this.tagView.highlightedTag);
									 //console.log("hr"+this.hitRight);
									 //if(this.tagView.highlightedTag == null){
											this.hitRight = 0;
											
									 //}
											//use case for if were circling around
											if(this.tagView.highlightedTag == null && this.hitRight==0){
												this.hitRight = 2;
											}
								 }

						},
						_highlightRightTag : function(e) {
							// console.log(this.inputView.$input);
							 
							 if (this.inputView.$input.val().length <= 0 || getCaretPos(this.inputView.$input.get(0)) == 0 ) {
								 //console.log("test");
								 //this.tagView.popTag();
								 //killEvent(e);
								 this.tagView.highlightRightTag();
								 //console.log("hitRight"+this.hitRight);
								 if(this.tagView.highlightedTag == null){
										this.hitRight = this.hitRight + 1;
								 }
								 else{
										this.hitRight = 0;
										
								 }
								if(this.hitRight==1){
									this.inputView.$input.flash("0,191,255", 1000);;

								}
								if(this.hitRight < 2){
									
									 e.data.preventDefault();
									 e.data.stopImmediatePropagation() ;
								 
								}

								 //moveCaretToStart(this.inputView.$input.get(0));
							 }

					}
						});
		return TypeaheadView;
		function buildDomStructure(input) {
			var $wrapper = $(html.wrapper), $dropdown = $(html.dropdown), $input = $(input), $hint = $(html.hint);
			$wrapper.attr("id",$(input).attr('id'));
			$input.removeAttr('id');
			$wrapper = $wrapper.css(css.wrapper);
			$dropdown = $dropdown.css(css.dropdown);
			$hint.css(css.hint).css({
				backgroundAttachment : $input.css("background-attachment"),
				backgroundClip : $input.css("background-clip"),
				backgroundColor : $input.css("background-color"),
				backgroundImage : $input.css("background-image"),
				backgroundOrigin : $input.css("background-origin"),
				backgroundPosition : $input.css("background-position"),
				backgroundRepeat : $input.css("background-repeat"),
				backgroundSize : $input.css("background-size")
			});
			$input.data("ttAttrs", {
				dir : $input.attr("dir"),
				autocomplete : $input.attr("autocomplete"),
				spellcheck : $input.attr("spellcheck"),
				style : $input.attr("style")
			});
			$input.addClass("tt-query").attr({
				autocomplete : "off",
				spellcheck : false
			}).css(css.query);
			try {
				!$input.attr("dir") && $input.attr("dir", "auto");
			} catch (e) {
			}
			//console.log($input.wrap($wrapper).parent());
			//var container = $input.wrap($wrapper).parent();
			
			return $input.wrap($wrapper).parent().prepend($hint).append(
					$dropdown);
		}
		function destroyDomStructure($node) {
			var $input = $node.find(".tt-query");
			utils.each($input.data("ttAttrs"), function(key, val) {
				utils.isUndefined(val) ? $input.removeAttr(key) : $input.attr(
						key, val);
			});
			$input.detach().removeData("ttAttrs").removeClass("tt-query")
					.insertAfter($node);
			$node.remove();
		}
	}();
	(function() {
		var cache = {}, viewKey = "ttView", methods;
		methods = {
			initialize : function(datasetDefs) {
				var datasets;
				datasetDefs = utils.isArray(datasetDefs) ? datasetDefs
						: [ datasetDefs ];
				if (datasetDefs.length === 0) {
					$.error("no datasets provided");
				}
				datasets = utils.map(datasetDefs, function(o) {
					var dataset = cache[o.name] ? cache[o.name]
							: new Dataset(o);
					if (o.name) {
						cache[o.name] = dataset;
					}
					return dataset;
				});
				//console.log(datasets);
				return this.each(initialize);
				function initialize() {
					var $input = $(this), deferreds, eventBus = new EventBus({
						el : $input
					});
					deferreds = utils.map(datasets, function(dataset) {
						return dataset.initialize();
					});
					$input.data(viewKey, new TypeaheadView({
						input : $input,
						eventBus : eventBus = new EventBus({
							el : $input
						
						}),
						datasets : datasets
					}));
					$.when.apply($, deferreds).always(function() {
						utils.defer(function() {
							eventBus.trigger("initialized");
						});
					});
				}
			},
			destroy : function() {
				return this.each(destroy);
				function destroy() {
					var $this = $(this), view = $this.data(viewKey);
					if (view) {
						view.destroy();
						$this.removeData(viewKey);
					}
				}
			},
			addTag: function(val){
				//console.log(val);
				console.log($(this).data(viewKey));
				$(this).data(viewKey).tagView.prefill(val);
			},
			setQuery : function(query) {
				return this.each(setQuery);
				function setQuery() {
					var view = $(this).data(viewKey);
					view && view.setQuery(query);
				}
			}
		};
		jQuery.fn.typeahead = function(method) {
			if (methods[method]) {
				return methods[method].apply(this, [].slice.call(arguments, 1));
			} else {
				return methods.initialize.apply(this, arguments);
			}
		};
	})();

	// //// End twitter bootstrap

	// return this.each(function () {
	//

	//
	//
	//
	//
	//

	//
	// // handle ESC (keyup used for browser compatibility)
	// if (this.tagManagerOptions.isClearInputOnEsc) {
	// obj.on('keyup', function (e) {
	// if (e.which == 27) {
	// // console.log('esc detected');
	// $(this).val('');
	// killEvent(e);
	// }
	// });
	// }
	//
	// obj.on('keypress', function (e) {
	// // push ASCII-based delimiters
	// if (keyInArray(e, delimiterChars)) {
	// applyDelimiter(e);
	// }
	// });
	//
	// obj.on('keydown', function (e) {
	// // disable ENTER
	// if (e.which == 13) {
	// if (this.tagManagerOptions.preventSubmitOnEnter) {
	// killEvent(e);
	// }
	// }
	//
	// // push key-based delimiters (includes <enter> by default)
	// if (keyInArray(e, delimiterKeys)) {
	// applyDelimiter(e);
	// }
	// });
	//
	// // BACKSPACE (keydown used for browser compatibility)

	//
	// obj.change(function (e) {
	//
	// if (!/webkit/.test(navigator.userAgent.toLowerCase())) { $(this).focus();
	// } // why?
	//
	// var taItem = typeaheadSelectedItem();
	// var taVisible = typeaheadVisible();
	//
	// if (taItem && taVisible) {
	// taItem.removeClass(this.tagManagerOptions.typeaheadOverrides.selectedClass);
	// pushTag(taItem.attr('data-value'));
	// // console.log('change: pushTypeAheadTag ' + tag);
	// }
	// /* unimplemented mode to push tag on blur
	// else if (this.tagManagerOptions.pushTagOnBlur) {
	// console.log('change: pushTagOnBlur ' + tag);
	// pushTag($(this).val());
	// } */
	// killEvent(e);
	// });
	//
	// if (this.tagManagerOptions.prefilled != null) {
	// if (typeof (this.tagManagerOptions.prefilled) == "object") {
	// prefill(this.tagManagerOptions.prefilled);
	// } else if (typeof (this.tagManagerOptions.prefilled) == "string") {
	// prefill(this.tagManagerOptions.prefilled.split(baseDelimiter));
	// } else if (typeof (this.tagManagerOptions.prefilled) == "function") {
	// prefill(this.tagManagerOptions.prefilled());
	// }
	// } else if (this.tagManagerOptions.hiddenTagListId != null) {
	// prefill($('#' +
	// this.tagManagerOptions.hiddenTagListId).val().split(baseDelimiter));
	// }
	// });

})(jQuery);

function getCaretPos(el) { 
	  if (el.selectionStart) { 
	    return el.selectionStart; 
	  } else if (document.selection) { 
	    el.focus(); 

	    var r = document.selection.createRange(); 
	    if (r == null) { 
	      return 0; 
	    } 

	    var re = el.createTextRange(), 
	        rc = re.duplicate(); 
	    re.moveToBookmark(r.getBookmark()); 
	    rc.setEndPoint('EndToStart', re); 

	    return rc.text.length; 
	  }  
	  return 0; 
}
function moveCaretToStart(el) {
    if (typeof el.selectionStart == "number") {
        el.selectionStart = el.selectionEnd = 0;
    } else if (typeof el.createTextRange != "undefined") {
        el.focus();
        var range = el.createTextRange();
        range.collapse(true);
        range.select();
    }
}

jQuery.fn.flash = function( color, duration )
{
    var current = this.css( 'background-color' );
	this.stop().css("background-color", "#FFFF9C")
	.animate({ backgroundColor: "#FFFFFF"}, duration);

}