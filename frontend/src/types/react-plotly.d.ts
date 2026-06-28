declare module "react-plotly.js" {
  import * as React from "react";

  export interface PlotParams {
    data?: unknown[];
    layout?: Record<string, unknown>;
    config?: Record<string, unknown>;
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
  }

  export default class Plot extends React.Component<PlotParams> {}
}

