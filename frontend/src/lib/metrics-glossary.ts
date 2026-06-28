export type MetricGlossaryEntry = {
  id: string;
  title: string;
  definition: string;
  whyItMatters: string;
  example: string;
  methodologyPath?: string;
};

export const METRIC_GLOSSARY: Record<string, MetricGlossaryEntry> = {
  var: {
    id: "var",
    title: "Value at Risk (VaR)",
    definition: "The estimated loss that should not be exceeded over the forecast horizon at a chosen confidence level (e.g., 95%).",
    whyItMatters: "It summarizes downside risk in one number that risk committees can compare across models and assets.",
    example: "A 95% VaR of -8% means that in a typical bad scenario, the asset might lose about 8% over the horizon.",
    methodologyPath: "/methodology/Historical"
  },
  expected_shortfall: {
    id: "expected_shortfall",
    title: "Expected Shortfall",
    definition: "The average loss in the worst tail scenarios beyond the VaR threshold.",
    whyItMatters: "VaR ignores how bad the tail can get; expected shortfall captures severity once you are already in trouble.",
    example: "If VaR is -8% but expected shortfall is -12%, the worst outcomes are materially worse than VaR alone suggests.",
    methodologyPath: "/methodology/Monte%20Carlo"
  },
  expected_return: {
    id: "expected_return",
    title: "Expected Return",
    definition: "The model's central estimate of return over the selected forecast horizon.",
    whyItMatters: "It anchors the upside/downside debate, but should always be read alongside risk metrics.",
    example: "An expected return of +3% over 30 days implies a modest positive drift under the model's assumptions.",
    methodologyPath: "/methodology/Bayesian"
  },
  prob_positive: {
    id: "prob_positive",
    title: "Probability Positive",
    definition: "The estimated chance that the asset finishes the horizon with a positive return.",
    whyItMatters: "It translates the return distribution into an intuitive directional probability.",
    example: "A 62% probability positive means the model assigns slightly better-than-even odds to gains.",
    methodologyPath: "/methodology/Monte%20Carlo"
  },
  confidence_level: {
    id: "confidence_level",
    title: "Confidence Level",
    definition: "The probability threshold used for risk intervals such as VaR and confidence bands.",
    whyItMatters: "Higher confidence levels focus on rarer, more severe outcomes.",
    example: "95% confidence focuses on the worst 5% of simulated or historical outcomes.",
    methodologyPath: "/methodology"
  },
  realized_volatility: {
    id: "realized_volatility",
    title: "Realized Volatility",
    definition: "How much the asset's price has actually moved recently, annualized from historical returns.",
    whyItMatters: "Volatility scales both opportunity and risk; many models use it as a core input.",
    example: "20% annualized volatility means daily moves are typically larger than a 10% volatility asset.",
    methodologyPath: "/methodology/GARCH"
  },
  monte_carlo: {
    id: "monte_carlo",
    title: "Monte Carlo Simulation",
    definition: "A method that simulates thousands of possible price paths using estimated return and volatility.",
    whyItMatters: "It explores a full distribution of outcomes instead of relying on a single historical window.",
    example: "If 950 of 1,000 simulated paths lose money, downside risk is structurally elevated.",
    methodologyPath: "/methodology/Monte%20Carlo"
  },
  garch: {
    id: "garch",
    title: "GARCH Volatility",
    definition: "A model where volatility changes over time based on recent shocks and persistence.",
    whyItMatters: "Markets cluster volatility; GARCH adapts faster after stress events than static estimates.",
    example: "After a sharp selloff, GARCH often raises forward volatility even if long-run history looks calm.",
    methodologyPath: "/methodology/GARCH"
  },
  bootstrap: {
    id: "bootstrap",
    title: "Bootstrap Resampling",
    definition: "A technique that rebuilds possible futures by resampling historical returns.",
    whyItMatters: "It preserves historical return patterns without assuming a perfect normal distribution.",
    example: "If past returns had fat tails, bootstrap simulations inherit those tail features.",
    methodologyPath: "/methodology/Bootstrap"
  },
  bayesian: {
    id: "bayesian",
    title: "Bayesian Estimation",
    definition: "A framework that updates beliefs about returns and risk using prior assumptions plus observed data.",
    whyItMatters: "It can stabilize estimates when history is short or noisy.",
    example: "With limited data, Bayesian methods shrink extreme estimates toward a prudent prior.",
    methodologyPath: "/methodology/Bayesian"
  },
  correlation: {
    id: "correlation",
    title: "Correlation",
    definition: "How closely two assets move together, ranging from -1 to +1.",
    whyItMatters: "Portfolio risk depends heavily on whether holdings move in the same direction during stress.",
    example: "Two assets with 0.85 correlation offer less diversification than two assets near 0.20.",
    methodologyPath: "/methodology"
  },
  volatility: {
    id: "volatility",
    title: "Volatility",
    definition: "The typical magnitude of price fluctuations over time.",
    whyItMatters: "Higher volatility widens forecast ranges and usually increases VaR.",
    example: "An asset moving ±2% daily is more volatile than one moving ±0.5% daily.",
    methodologyPath: "/methodology/GARCH"
  },
  confidence_interval: {
    id: "confidence_interval",
    title: "Confidence Interval",
    definition: "A range of returns that the model expects to contain most outcomes at the chosen confidence level.",
    whyItMatters: "It shows uncertainty around the point forecast, not just a single expected return.",
    example: "A wide interval signals the model sees many plausible outcomes; a narrow one signals tighter conviction.",
    methodologyPath: "/methodology/Monte%20Carlo"
  },
  probability_distribution: {
    id: "probability_distribution",
    title: "Probability Distribution",
    definition: "The full shape of possible returns, including central tendency and tail risk.",
    whyItMatters: "Two assets can share the same expected return but have very different tail risks.",
    example: "A distribution skewed left has more downside tail mass even if the average looks fine.",
    methodologyPath: "/methodology/Monte%20Carlo"
  },
  committee_agreement: {
    id: "committee_agreement",
    title: "Committee Agreement",
    definition: "How closely the selected models agree on direction and magnitude.",
    whyItMatters: "Low agreement means conclusions should be treated with extra caution.",
    example: "If three models are bullish and three bearish, agreement is low even if consensus is neutral.",
    methodologyPath: "/methodology"
  },
  overall_confidence: {
    id: "overall_confidence",
    title: "Overall Confidence",
    definition: "A blended score combining individual model confidence and cross-model agreement.",
    whyItMatters: "It helps distinguish a strong consensus from a fragile one.",
    example: "High model confidence with low agreement still produces moderate overall confidence.",
    methodologyPath: "/methodology"
  },
  historical_analog: {
    id: "historical_analog",
    title: "Historical Analog",
    definition: "A past market period whose price pattern resembles the current setup.",
    whyItMatters: "Analogs provide context for what happened after similar conditions, without claiming prediction.",
    example: "A high-similarity analog that led to higher volatility afterward flags a plausible regime risk.",
    methodologyPath: "/methodology/Historical"
  }
};

const LABEL_TO_GLOSSARY: Record<string, string> = {
  "Value at Risk (VaR)": "var",
  VaR: "var",
  "Expected Shortfall": "expected_shortfall",
  "Expected Return": "expected_return",
  "Probability Positive": "prob_positive",
  "Confidence Level": "confidence_level",
  "Realized Volatility": "realized_volatility",
  "Overall Confidence": "overall_confidence",
  "Committee Agreement": "committee_agreement",
  "Forecast Confidence": "overall_confidence",
  Correlation: "correlation",
  Volatility: "volatility",
  Momentum: "expected_return",
  "Afterward Return": "expected_return",
  "Afterward Vol": "volatility"
};

export function glossaryForLabel(label: string): MetricGlossaryEntry | undefined {
  const key = LABEL_TO_GLOSSARY[label] ?? label.toLowerCase().replaceAll(" ", "_");
  return METRIC_GLOSSARY[key];
}

export const SUGGESTED_EXPLAIN_QUESTIONS = [
  "Why is VaR high?",
  "Why do models disagree?",
  "What assumptions matter most?",
  "Explain the GARCH result.",
  "How should I read expected shortfall?",
  "What do the historical analogs imply?"
] as const;
