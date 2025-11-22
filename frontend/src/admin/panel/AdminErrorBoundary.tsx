import React from "react";

export class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error("[AdminPanel] Runtime error:", error, info);
  }
  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error);
      return (
        <div className="min-h-screen w-full grid place-items-center bg-neutral-50 p-6">
          <div className="max-w-xl w-full rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow">
            <div className="text-lg font-semibold mb-2">Admin crashed</div>
            <div className="text-sm whitespace-pre-wrap break-words">{msg}</div>
            <div className="mt-3 text-xs text-red-700/80">
              Check the browser console for stack trace. Try reloading the page.
            </div>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}
