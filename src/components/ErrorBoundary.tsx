import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearAll } from '../lib/storage';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** 顶层错误边界：出错时给出可操作的恢复路径，而不是白屏 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 只打印到控制台，不上报任何地方
    console.error('[cyber-life] render error', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleClear = (): void => {
    clearAll();
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="fatal">
        <div className="fatal-box">
          <p className="fatal-code">FATAL / RENDER_FAULT</p>
          <h1>终端渲染出错了</h1>
          <p className="fatal-desc">
            这只是一个前端页面故障，和你的设备、账号、隐私没有关系（本页也不读取任何设备信息）。
            可以先刷新重试；如果反复出现，清除本地数据再进入。
          </p>
          <pre className="fatal-msg">{error.message}</pre>
          <div className="fatal-actions">
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              刷新页面
            </button>
            <button type="button" className="btn" onClick={this.handleClear}>
              清除本地数据并重试
            </button>
          </div>
        </div>
      </div>
    );
  }
}
