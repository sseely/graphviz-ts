# Verdict decision flow

Current vs fixed path for a corpus input in `surveyOne`.

```mermaid
flowchart TD
    A[oracleSvg: run native dot] --> B{oracle.svg undefined?<br/>empty / timeout / no closing tag}
    B -- yes --> OE[verdict: oracle-error]
    B -- no --> C{NEW T1:<br/>isWellFormedSvg oracle?}
    C -- no --> OE
    C -- yes --> D[portSvg: render port]
    D --> E{port.svg undefined?}
    E -- yes --> ERR[verdict: errored / timeout]
    E -- no --> F[diffVerdict: compareSvg]
    F -- throws --> DIV["verdict: diverged /<br/>&lt;compare-threw&gt; (port-side only now)"]
    F -- pass --> CONF[conformant]
    F -- diffs --> SM[structural-match / diverged]
```

Before T1, the `C` node did not exist: a non-well-formed oracle fell through to
`F`, where `compareSvg` threw on the oracle and was mislabeled `diverged`
(`1472`). After T1, `C` routes it to `oracle-error`; only a genuine **port-side**
parse failure can still reach the `throws` edge at `F`.
