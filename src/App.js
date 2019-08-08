import React, { Component } from 'react';
import './App.css';

let ws = null
// let klineAll = {
//   id: 8,
//   method: 'kline.query',
//   params: ['BTCUSDT', 1560686476, 1561982536, 900]
// }
const config = {
  supports_search: false, 
  supports_group_request: false, 
  supported_resolutions : ["1", "5", "15", "30", "60", "1D", "1W"], //周期
  supports_marks: true, //  是否支持在K线上显示标记
  supports_time: true, // 用于在价格刻度上显示倒计时
  exchanges: [ // 交易所对象数组
    {
      value: 'BCH',
      name: 'All Exchanges',
      desc: ''
    }
  ]
}

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      datafeed: null,
      HCk: null,
      SUB: null,
      historyData: [],
      lastTime: 0
    }
  }
  componentDidMount() {
    this.setDataFeed()
    this.webSocketInit()
  }
  // 需要等待setDataFeed动作结束
  widgetInit = () => {
    let _this = this
    window.tvWidget = new window.TradingView.widget({
      // debug: true,
      fullscreen: false, //自适应
      width: 960,
      height: 500,
      symbol: 'BTCUSDT', //初始商品
      interval: '15', //初始周期
      container_id: "App",
      // datafeed: new window.Datafeeds.UDFCompatibleDatafeed("https://demo_feed.tradingview.com"),
      datafeed: _this.state.datafeed, //数据
      library_path: "charting_library/", //static文件夹的路径
      // locale: getParameterByName('lang') || "en",
      locale: "zh", //图标库的本地化处理--选择语言
      disabled_features: ["use_localstorage_for_settings"], //禁用的功能
      enabled_features: ["study_templates"], //启用的功能
      charts_storage_url: 'http://saveload.tradingview.com', //
      charts_storage_api_version: "1.1", //版本
      client_id: 'tradingview.com', //站点的url
      user_id: 'public_user_id' //用户的id 所有用户id都相同时 每个用户查看到的数据是一样的
    })
    // window.addEventListener('DOMContentLoaded', this.widgetInit, false)
  }
  // 设置配置数据
  setDataFeed = () => {//(至少)四个构造函数(固定格式的)
    let datafeed = {
      onReady: cb => {  
        setTimeout(() => {
          cb(config)
        }, 0);
      },
      //通过商品名称解析商品信息
      resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => { 
        var symbol_stub = {  
          name: symbolName, //商品名称
          ticker: symbolName, // 商品体系中此商品的唯一标识符
          description: "", //商品描述
          has_intraday: true,  //布尔值显示商品是否具有日内（分钟）历史数据
          has_no_volume: false,  // 商品是否拥有成交量数据
          minmov: 1, //最小波动
          minmov2: 2,  //价格精度 
          pricescale: 100000, // 1/50000的1/2
          session: "24x7", // 自定义交易时段
          supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W", "1M"], //在这个商品的周期选择器中启用一个周期数组。 数组的每个项目都是字符串
          timezone: "Asia/Shanghai", //选择交易时区
          type: "stock" //选择仪表类型
        }

        setTimeout(() => { //回调函数
          onSymbolResolvedCallback(symbol_stub)
        }, 0)
      },
      //获取数据
      getBars: (symbolInfo, resolution, from, to, onHistoryCallback, onErrorCallback, firstDataRequest) => { 
        // 周期设置 -- 转换成秒
        resolution = this.timeConversion(resolution)
        this.setState({
          HCK: onHistoryCallback
        }, () => {
          let params = [symbolInfo.name, from, to, resolution]
          this.sendKlineQueryReq(params)
        })
      },
       //引入数据
      subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) => {
        resolution = this.timeConversion(resolution)
        let params = [
          symbolInfo.name,
          resolution
        ]
        this.setState({
          SUB: onRealtimeCallback
        }, () => {
          this.sendKlineSubReq(params)
        })
      }
    }
    this.setState({
      datafeed
    }, () =>{
      this.widgetInit()
    })
  }
  // websocket
  webSocketInit = () => {
    if ('WebSocket' in window) {
      if (ws === null) {
        ws = new WebSocket('wss://socket.coinex.com/')
      }
      ws.onopen = () => {
        console.log('连接成功')
        // ws.send(JSON.stringify(kline))
      }
      ws.onmessage = res => {
        this.WSHandler(JSON.parse(res.data))
      }
      ws.onclose = () => {
        console.log('连接关闭')
      }
    } else {
      console.log('您的浏览器不支持websocket')
    }
  }
  // websocket接受数据,处理数据
  WSHandler = res => {
    console.log(res)
    if (res.ttl === 400) {
      // 历史数据
      let historyData = res.result.map(val => {
        // console.log(val)
        return {
          time: Number(val[0]) * 1000,
          close: Number(val[2]),
          open: Number(val[1]),
          high: Number(val[3]),
          low: Number(val[4]),
          volume: Number(val[5])
        }
      })
      this.setState({
        lastTime: historyData[historyData.length - 1].time,
        historyData
      }, () => {
        if (historyData && historyData.length) {
          setTimeout(() => {
            this.state.HCK(historyData, { noData: false })
          }, 0)
        } else {
          this.state.HCK(historyData, { noData: true })
        }
      })
    } 
    if (res.method === 'kline.update') {
      // 实时数据
      let bars = res.params.map(val => {
        return {
          time: Number(val[0]) * 1000,
          close: Number(val[2]),
          open: Number(val[1]),
          high: Number(val[3]),
          low: Number(val[4]),
          volume: Number(val[5])
        }
      })[0]
      console.log('bars.time',bars.time)
      // 对比存储的最新时间和最新数据的时间大小来更新数据
      if (this.state.lastTime - bars.time <= 0) {
        setTimeout(() => {
          this.state.SUB(bars)
        }, 0)
      }
    }
  }
  // 将周期转换成秒
  timeConversion = time => { 
    switch(time) { 
      case ('1M' || '1W' || '1D' || 'D'):
        return 86400
      case '240':
        return 14400
      case '120':
        return 7200
      case '60':
        return 3600
      case '30':
        return 1800
      case '15':
        return 900
      case '5':
        return 300
      case '1':
        return 60
      default:
        return 86400
    }
  }
  // websocket发送请求
  sendRequest = data => {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(data))
    } else {
      ws.onopen = () => {
        ws.send(JSON.stringify(data))
      }
    }
  }
  // 发送历史数据请求
  sendKlineQueryReq = params => {
    let data = {
      id: 8,
      method: 'kline.query',
      params: params
    }
    this.sendRequest(data)
  }
  // 发送实时数据请求
  sendKlineSubReq = params => {
    let data = {
      id: 9,
      method: 'kline.subscribe',
      params: params
    }
    this.sendRequest(data)
  }
  render() {
    return (
      <div id="App">
      </div>
    );
  }
}

export default App;
