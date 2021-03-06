'use strict';
/**
    数据管理模块
    
    Feartures : 
        1. dataServices ：数据服务接口
        2. dataManager ：基于策略的数据管理基类
        3. dataPolicyManager ：数据策略管理器；

    Update Note：
        + 2014.7 ：Created

    @module DataManager
*/
_stDefine('dataManager', function(st) {

	var dataManager, policyManager, dataServices,
		_config = {
			ignoreMerges: ["params", "filter", "_filterBuilder"],
			dmOp: {
				set: {},
				get: {}
			}
		},
		defFilterBuilder = st.filterBuilder(),
		promiseEvent = st.promiseEvent,
		isFunction = st.isFunction;

	/**
	   数据服务管理；定义了数据服务的接口和通用操作方法；不能直接使用，必须创建具体类型的数据服务； 
	   数据服务的定义就比较广了，可以是具体的对象方式locaStorage，IndexDB，或者是一些行为ajax，comet，websocket；也可以是根据业务规则定义的rest，cache等；
	   @class dataServices
	   @constructor
	   @extends factory
       @demo test/dataManager/demo.js [dataServices]
	 */
	dataServices = st.factory({
		name: "dataServices",
		proto: {
			/**
			 * 数据服务通用操作方法；直接执行到具体的数据服务的方法上
			 * @method  operate
			 * @param  {string} type 操作类型；1. search; 2. update
			 * @param  {object} op   参数；具体参数同数据服务
			 * @param  {object} op.dsType   数据服务类型
			 * @return {object|promise}      操作结果或者promise
			 */
			operate: function(type, op) {
				var ds = this.find(op.dsType);
				if (ds) {
					if (type !== 'initOptions') {
						ds.initOptions(op);
					}
					return ds[type](op);
				} else
					throw op.dsType + ",not defined in dataServices!";
			},
			/**
			 * 执行数据服务search操作方法
			 * @method  search
			 * @param  {object} op   参数；具体参数同数据服务
			 * @param  {object} op.dsType   数据服务类型
			 * @return {object}      操作结果
			 */
			search: function(op) {
				return this.operate('search', op);
			},
			/**
			 * 执行数据服务update操作方法
			 * @method  update
			 * @param  {object} op   参数；具体参数同数据服务
			 * @param  {object} op.dsType   数据服务类型
			 * @return {object}      操作结果
			 */
			update: function(op) {
				return this.operate('update', op);
			}
		},
		/**
		 * 数据服务基类
		 * @class baseDataService
		 */
		base: {
			/**
			 * 查询操作接口  **[接口方法]**
			 * @method  search
			 * @param  {object} op   参数；其他具体参数同见具体数据服务
			 *    @param  {object} op.filter   过滤器
			 *    @param  {object} op.success   成功之后执行的方法
			 *    @param  {object} op.error   失败之后执行的方法
			 * @return {object}      操作结果
			 */
			search: function(op) {},
			/**
			 * 更新操作接口 **[接口方法]**
			 * @method  update
			 * @param  {object} op   参数；其他具体参数同见具体数据服务
			 *    @param  {object} op.filter   过滤器
			 *    @param  {object} op.data   更新数据
			 *    @param  {object} op.success   成功之后执行的方法
			 *    @param  {object} op.error   失败之后执行的方法
			 * @return {object}      操作结果
			 */
			update: function(op) {},
			/**
			 * 通用初始化参数接口 **[接口方法]**
			 * @method  initOptions
			 * @param  {object} op   参数；其他具体参数同见具体数据服务
			 *    @param  {object} op.filter   过滤器
			 *    @param  {object} op.success   成功之后执行的方法
			 *    @param  {object} op.error   失败之后执行的方法
			 * @return {object}      参数
			 */
			initOptions: function(op) {}
		}
	})

	/**
	   数据管理器工厂； 更多数据管理的例子见smartjs其他数据管理项
	   @class dataManager
	   @constructor
	   @extends factory
       @demo test/dataManager/demo.js [dataManager]

	 */
	dataManager = st.factory({
		name: "dataManager",
		type: "class",
		proto: {
			/**
			 * 创建数据管理器
			 * @method create
			 * @param  {string} type 数据管理器类型
			 * @param  {object} op   数据管理参数设置
			 * @return {dataManager}     数据管理对象
			 */
			create: function(type, op) {
				var dm = this.find(type);
				if (dm)
					return new dm(op);
				else
					console.log(type + ",not defined in dataManager");
			}
		},
		/**
		 * 数据管理器基类
		 * @class baseDataManager
		 */
		base: {
			/**
			 * 是否过滤模式; true时,使用filterBuilder组织过滤
			 * @type {Boolean} _filterMode
			 * @default true
			 */
			_filterMode: true,
			//_operations : ["get","set"],
			/**
			 * 数据管理对象的类初始化方法；
			 * @method klassInit
			 * @final
			 * @param op {object}  数据管理设置参数
			 * @return {dataManager}   初始化完成的数据管理对象
			 */
			klassInit: function(op) {
				var dm = st.attachTrigger(this);

				op = dm.op = st.mix(op, _config.dmOp);

				initPolicy(dm, op.get, 'get');
				initPolicy(dm, op.set, 'set');

				initFlow(dm);
				policyManager.applyPolicy(dm, dm._Flow, op);
				this.init(op);
			},
			/**
			 * 数据管理对象的初始化接口方法 **[接口方法]**
			 * @method init
			 * @param  op {object} 数据管理设置参数
			 */
			init: function(op) {},
			/**
			 * 使用dataManager的数据通道进行获取数据
			 * @method get
			 * @param  conf {object} 获取设置参数
			 * @return {object|promise}   查询结果或者promise
			 */
			get: function(conf) {
				var dm = this;
				conf = initConf(dm, conf);
				return whenFlow(dm._Flow.boot(dm, dm.op, conf.policy), conf.success, conf.error);
			},
			/**
			 * 使用dataManager的数据通道进行设置数据
			 * @method set
			 * @param  conf {object} 设置参数
			 * @return {object|promise}   设置结果或者promise
			 */
			set: function(conf) {
				var dm = this;
				conf = initConf(dm, conf);
				return whenFlow(dm._Flow.bootWithStart("setData", [dm, dm.op, conf.policy]), conf.success, conf.error);
			},
			/**
			 * 使用dataManager内置查询(即只在dataManager内部查询，不查询dataService)接口. **[接口方法]**
			 * @method _innerSearch
			 * @param  conf {object} 获取设置参数
			 * @return {object}   查询结果
			 */
			_innerSearch: function(conf) {

			},
			/**
			 * 使用dataManager内置更新(即只在dataManager内部更新，不更新到dataService)接口. **[接口方法]**
			 * @method _innerUpdate
			 * @param  conf {object} 设置参数
			 * @return {object}   设置结果
			 */
			_innerUpdate: function(conf) {

			},
			/**
			 * 检查数据是否为空;数据策略的判断空数据会根据此方法的结果来判断;不同类型的数据管理的判断也不同。
			 * 如：object判断是否为undefined;table判断数据的长度是否大于0
			 * @method checkEmpty
			 * @param  data {object} 检查的数据
			 * @param  conf {object} 设置参数
			 * @return {[type]}  判断是否为空
			 */
			checkEmpty: function(data, conf) {
				return data === undefined;
			},
			//验证方法
			validate: function() {

			},
			/**
			 * 清空数据管理内的数据的方法. **[接口方法]**
			 * @method clear
			 */
			clear: function() {
			},
			/**
			 * 设置dataService的参数,在每次使用数据通道时执行. **[接口方法]**
			 * @method setDataSerive
			 * @param config {object} 设置dataService的参数
			 */
			setDataSerive: function(config) {},
			/**
			 * 初始化策略参数
			 * @method initPolicy
			 * @param  policy {object} 策略设置
			 * @param  type  {type}  操作类型. 
			 *  1. get; 
			 *  2. set;
			 */
			initPolicy: function(policy, type) {
				if (this._filterMode) {
					policy._filterBuilder = policy.filter ? st.filterBuilder(policy.filter) : defFilterBuilder;
				}
			},
			/**
			 * 生成传递的参数
			 * @method buildParam
			 * @param  policy {object}    策略设置
			 * @param  defPolicy {object} 默认的策略设置
			 */
			buildParams: function(policy, defPolicy) {
				buildParams(this, policy, defPolicy);
			},
			/**
			 * 生成策略，对策略参数进行初始化，生成传递参数，合并参数
			 * @method  buildPolicy
			 * @param  policy {object}    策略设置
			 * @param  defPolicy {object}  默认的策略设置
			 */
			buildPolicy: function(policy, defPolicy) {
				this.buildParams(policy, defPolicy)
				st.mix(policy, defPolicy, _config.ignoreMerges);
			}
		}
	});

	function initFlow(dm) {
		dm._Flow = st.flowController({
			flow: {
				buildGetPolicy: function(e, dm, op, policy, isTrigger) {
					//合并策略
					dm.buildPolicy(policy, op.get);
				},
				getData: function(e, dm, op, policy, isTrigger) {
					var result = searchDM(dm, policy);
					e.__getDone = true;
					if (checkEmpty(dm, result, policy)) {
						e.next("getFromDs");
					} else {
						e.next("getFromDm");
					}
					return result;
				},
				getFromDm: function(e, dm, op, policy, isTrigger) {
					var result = e.__getDone ? e.result : searchDM(dm, policy);
					if (!policy.update)
						e.end();

					return result;
				},
				getFromDs: function(e, dm, op, policy, isTrigger) {
					var success, ds = getDs(policy, op);
					if (ds) {
						success = function(result) {
							if (policy.update !== false) {
								dm.set(buildGetSetPolicy(dm, result, policy,
									function(result) {
										e.end().resolve(result);
									}, e.reject));

							} else {
								e.end().resolve(result);
							}
						}

						openDatatransfer('search', ds, dm, policy, success, e.reject);
						return e.promise();
					} else {
						e.end().resolve(searchDM(dm, policy));
					}
				},
				setData: function(e, dm, op, policy, isTrigger) {
					//合并策略
					dm.buildPolicy(policy, op.set);
					e.next(policy.way === 'ds' ? 'setToDs' : 'setToDm');
				},
				setToDm : function(e, dm, op, policy, isTrigger){
					if(policy.way !== 'dm')
						e.next('setToDs');
					return dm._innerUpdate(policy);;
				},
				setToDs: function(e, dm, op, policy, isTrigger) {
					var success, error, ds = getDs(policy, op),
						isPending = policy.pending !== false;

					if (ds) {
						if (isPending) {
							success = e.resolve;
							error = e.reject;
						} else {
							e.resolve(data);
						}

						openDatatransfer('update', ds, dm, policy, success, error);

						if (isPending)
							return e.promise();
					}
				}
			},
			order: ["buildGetPolicy", "getData", "setData"],
			trigger: true
		});
	}

	function initPolicy(dm, policy, type) {
		if (policy) {
			dm.initPolicy(policy, type);
			if (policy.get && (type === 'get' || type === 'trigger'))
				dm.initPolicy(policy.get, 'set');
		}
	}

	/*初始化dm的get，set配置*/
	function initConf(dm, conf) {
		if (!conf) {
			conf = {};
		}
		var success = conf.success,
			error = conf.error;

		conf.success = null;
		conf.error = null;

		return {
			policy: conf,
			success: success,
			error: error
		};
	}

	function checkEmpty(dm, data, policy) {
		return (dm.op.checkEmpty || dm.checkEmpty)(data, policy)
	}

	function whenFlow(fireResult, success, error) {
		var d = st.Deferred();
		st.when(fireResult).done(function(result) {
			success && success(result);
			d.resolve(result);
		}).fail(function(err) {
			error && error(err);
			d.resolve(err);
		})
		return d.promise();
	}

	function buildParams(dm, policy, mgPolicy) {
		if(policy._$builded)
			return;
		
		var mgParams, pType, params = policy.params;

		//条件参数处理
		if (isFunction(params)) {
			params = policy.params = params.apply(null, [dm, policy]);
		}

		if (mgPolicy && policy.mergeFilter !== false) {
			mgParams = mgPolicy.params;

			if (isFunction(mgParams)) {
				mgParams = mgParams.apply(null, [dm, policy]);
			}

			if (params) {
				pType = typeof params;
				if (pType === typeof mgParams && pType === 'object') {
					//合并条件参数
					st.mix(params, mgParams);
				}
			} else {
				policy.params = mgParams;
			}
		}
		if (dm._filterMode) {
			var filterBuilder = mgPolicy && mgPolicy._filterBuilder || defFilterBuilder;
			policy.filter = filterBuilder.buildFn(policy.params, policy.filter);
		}
		policy._$builded = true;
	}

	function buildGetSetPolicy(dm, data, policy, success, error) {
		var setPolicy = {
			data: data,
			filter: policy.filter,
			params: policy.params,
			way: 'dm',
			pending: false,
			success: success,
			error: error
		};

		if (policy.set) {
			dm.buildPolicy(policy.set, setPolicy);
			return policy.set
		}
		return setPolicy;
	}

	function searchDM(dm, policy) {
		return dm._innerSearch(policy);
	}

	function getDs() {
		var args = arguments,
			len = args.length,
			i = 0,
			ds,arg;

		for (; i < len; i++) {
			if ((arg = args[i]) && (ds = arg.dataServices))
				return ds;
		};
	}

	/*开启数据传输*/
	function openDatatransfer(type, ds, dm, policy, success, error) {
		var dsOp, fnDsQueue, i = 0;

		function buildDsOp(op) {
			var conf = st.mergeMulti(true,[{},op, policy]);
			conf.success = success;
			conf.error = error;
			dm.setDataSerive(conf);
			return conf;
		}

		if (st.isArray(ds)) {
			fnDsQueue = function() {
				if (dsOp = ds[i++]) {
					dsOp = buildDsOp(dsOp);
					dsOp.success = function(result) {
						checkEmpty(dm, result, policy) ? fnDsQueue() : success(result);
					}
					dataServices.operate(type, dsOp);
				} else
					success(data);
			}
			fnDsQueue();
		} else
			dataServices.operate(type, buildDsOp(ds));
	}

	//策略管理器
	policyManager = st.factory({
		name: "DataPolicyManager",
		type: 'copy',
		proto: {
			applyPolicy: function(dm, flow, op) {
				this.fire('init', [dm, flow, op]);
			}
		},
		base: {
			init: function(dm, flow, op) {

			}
		}
	});

	policyManager.add("getWay", {
		init: function(dm, flow, op) {
			flow.onBefore("getData", "checkGetWay", function(e, dm, op, policy) {
				var way = policy.way,
					node;
				if (way) {
					if (way === 'ds') {
						node = 'getFromDs';
					} else if (way === 'dm') {
						node = 'getFromDm';
					}
					node && e.next(node).stop();
				}
			})

		}
	});

	/*判断并设置定时器*/
	function checkTimer(id, timer, fn, dm) {
		if (!timer)
			return fn;

		var timers = dm.__timers;
		if (!__timers) {
			timers = dm.__timers = {};
			dm.stopTimer = function(id) {
				var ts = this.__timers,
					no;
				if (st.isEmptyObject(ts))
					return;

				if (id) {
					if (no = ts[id]) {
						ts[id] = null;
						clearInterval(no);
					}
				} else {
					st.each(ts, function(i, no) {
						no && clearInterval(no);
					});
					this.__timers = {};
				}

			}
		}
		return function() {
			timers[id] = setInterval(fn, timer)
		}
	}

	/*解析Trigger*/
	function compileTrigger(i, conf, dm, flow, op) {
		var flowNode, fnRemove, conf = initConf(dm,conf),
			trPolicy = conf.policy,
			isDef = trPolicy.def,
			setPolicy = trPolicy.set,
			pos = trPolicy.position,
			delay = trPolicy.delay || 0,
			timer = trPolicy.timer,
			userfulLife = trPolicy.userfulLife;

		initPolicy(dm, trPolicy, 'trigger');

		//判断注入的流程节点
		flowNode = trPolicy.def ? "buildGetPolicy" : (pos === "get" ? "getData" : (pos === "dm" ? "getFromDm" : "getFromDs"));

		//注入Handler
		// success = st.mergeFn(trPolicy.success, function(result) {
		// 	dm.fireHandler("trigger", [result, trPolicy]);
		// });

		//有效期
		if (userfulLife) {
			if (userfulLife === "once") {
				fnRemove = function() {
					return true;
				}
			} else if (isFunction(userfulLife)) {
				fnRemove = userfulLife;
			}
		}

		flow.on(flowNode, "trigger", function(e, dm, op, policy, isTrigger) {
			var fnRequest, ds, _policy, fnSuccess;
			if (isTrigger)
				return;

			//默认时与get动作policy合并
			if (isDef) {
				dm.buildPolicy(policy, trPolicy);
				return;
			}

			_policy = st.mergeObj({
				mergeFilter: false,
				way: 'ds',
			}, trPolicy);

			//合并filter
			buildParams(dm, _policy, policy);

			fnRequest = function() {
				whenFlow(dm._Flow.bootWithStart("getData", [dm, dm.op, _policy, true]), conf.success, conf.error).always(function(result) {
					dm.fireHandler("trigger", [result, _policy]);
				});
			}

			setTimeout(checkTimer(i, timer, fnRequest, dm), delay);
		})
	}

	//添加触发器
	policyManager.add("trigger", {
		init: function(dm, flow, op) {
			var trigger = op.get && op.get.trigger;
			if (trigger) {

				st.each(trigger, function(i, trPolicy) {
					compileTrigger(i, trPolicy, dm, flow, op);
				});
				op.get.trigger = null;
			}
		}
	});

	return {
		dataManager: dataManager,
		dataPolicyManager: policyManager,
		dataServices: dataServices
	};
})