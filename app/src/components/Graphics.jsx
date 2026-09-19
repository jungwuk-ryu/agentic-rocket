import { useId } from "react";
import {
  ArrowRight,
  Code,
  Fingerprint,
  Stack,
  TestTube,
} from "@phosphor-icons/react";

export function PipelineVisual() {
  const id = useId().replaceAll(":", "");
  return (
    <figure className="pipeline-visual motion-scene" data-spotlight data-reveal>
      <div className="visual-kicker">
        <span>THE VERIFICATION ENGINE</span>
        <span>01 — 03</span>
      </div>
      <div className="engine-perspective">
        <svg
          className="engine-graphic"
          viewBox="0 0 480 450"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={`${id}-plate`}
              x1="100"
              y1="90"
              x2="355"
              y2="320"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#253d4c" stopOpacity=".94" />
              <stop offset="1" stopColor="#0b1926" stopOpacity=".98" />
            </linearGradient>
            <linearGradient
              id={`${id}-edge`}
              x1="95"
              y1="170"
              x2="375"
              y2="280"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#b4fb5a" stopOpacity=".15" />
              <stop offset=".5" stopColor="#cbff98" />
              <stop offset="1" stopColor="#9ed7ff" stopOpacity=".3" />
            </linearGradient>
            <radialGradient id={`${id}-aura`}>
              <stop stopColor="#b4fb5a" stopOpacity=".12" />
              <stop offset="1" stopColor="#b4fb5a" stopOpacity="0" />
            </radialGradient>
            <pattern
              id={`${id}-grid`}
              width="34"
              height="34"
              patternUnits="userSpaceOnUse"
              patternTransform="matrix(1 .56 -1 .56 240 92)"
            >
              <path
                d="M34 0H0V34"
                stroke="#7793a8"
                strokeOpacity=".12"
                strokeWidth=".7"
              />
            </pattern>
          </defs>
          <ellipse
            cx="240"
            cy="275"
            rx="228"
            ry="162"
            fill={`url(#${id}-aura)`}
          />
          <path
            d="M240 50 466 178v133L240 442 14 311V178Z"
            fill={`url(#${id}-grid)`}
          />
          <g className="engine-guides" stroke="#456077" strokeWidth=".8">
            <path
              d="m28 257 212 123 212-123M28 218 240 96l212 122M240 25v48M240 400v35"
              strokeDasharray="3 6"
            />
            <path d="M27 170v-13h13M440 157h13v13M27 338v13h13M440 351h13v-13" />
          </g>
          <g className="engine-layer engine-layer-bottom">
            <path
              d="m99 262 141 81 141-81v13l-141 82-141-82Z"
              fill="#08121c"
              stroke="#30485b"
            />
            <path
              d="m99 262 141-81 141 81-141 82Z"
              fill={`url(#${id}-plate)`}
              stroke="#496476"
            />
            <path
              d="m115 262 125 72 125-72"
              stroke={`url(#${id}-edge)`}
              strokeWidth="1.4"
            />
            <path
              d="m150 260 90 52 90-52-90-52Z"
              stroke="#546d75"
              strokeOpacity=".4"
            />
          </g>
          <g stroke="#a4d26b" strokeOpacity=".35" strokeDasharray="3 5">
            <path d="M99 190v70M381 190v70M240 273v69" />
          </g>
          <g className="engine-layer engine-layer-middle">
            <path
              d="m99 220 141 81 141-81v13l-141 82-141-82Z"
              fill="#0a1823"
              stroke="#355060"
            />
            <path
              d="m99 220 141-81 141 81-141 82Z"
              fill={`url(#${id}-plate)`}
              stroke="#7a9a83"
              strokeOpacity=".7"
            />
            {[0, 1, 2, 3, 4].map((n) => (
              <path
                key={n}
                d={`m${151 + n * 17} ${216 - n * 10} 71 41`}
                stroke="#b4fb5a"
                strokeOpacity={0.15 + n * 0.07}
                strokeWidth="3"
              />
            ))}
            <path
              d="m99 220 141 82 141-82"
              stroke={`url(#${id}-edge)`}
              strokeWidth="1.6"
            />
          </g>
          <g className="engine-layer engine-layer-top">
            <path
              d="m99 173 141 81 141-81v14l-141 81-141-81Z"
              fill="#111f2a"
              stroke="#486274"
            />
            <path
              d="m99 173 141-81 141 81-141 82Z"
              fill={`url(#${id}-plate)`}
              stroke={`url(#${id}-edge)`}
              strokeWidth="1.3"
            />
            <path
              d="m115 173 125-72 125 72-125 72Z"
              stroke="#809a9d"
              strokeOpacity=".25"
            />
            <path
              d="m187 173 53-31 53 31-53 31Z"
              fill="#132b29"
              stroke="#b4fb5a"
              strokeOpacity=".8"
            />
            <path
              d="m225 163-16 9 16 9m30-18 16 9-16 9m-9-24-12 30"
              stroke="#d3ffb0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="m129 173 13-7m195 7 13-7M240 115v7m0 106v7"
              stroke="#b4fb5a"
              strokeOpacity=".6"
            />
            <circle cx="240" cy="102" r="2" fill="#d0ff9e" />
          </g>
          <g className="engine-traces" stroke="#40574c">
            <path d="m150 304-61 35v30M240 354v47M330 304l61 35v30" />
            <path
              className="signal-flow"
              d="m150 304-61 35v30M240 354v47M330 304l61 35v30"
              stroke="#b4fb5a"
              strokeWidth="1.7"
            />
          </g>
          {[
            [89, 376],
            [240, 406],
            [391, 376],
          ].map(([x, y], index) => (
            <g
              key={x}
              className="engine-node"
              style={{ "--node-delay": `${index * -1.6}s` }}
            >
              <path
                d={`M${x - 26} ${y}l26-15 26 15-26 15Z`}
                fill="#14262a"
                stroke="#82a86a"
              />
              <path
                d={`M${x - 26} ${y}v7l26 15 26-15v-7M${x} ${y + 15}v7`}
                stroke="#476454"
              />
              <circle cx={x} cy={y} r="3" fill="#b4fb5a" />
            </g>
          ))}
          <g
            className="engine-annotations"
            fill="#8caaa9"
            fontSize="8"
            letterSpacing="1.5"
          >
            <text x="22" y="116">
              SOURCE
            </text>
            <path d="M64 113h34l30 18" fill="none" stroke="#40564d" />
            <text x="360" y="105">
              CANDIDATE
            </text>
            <path d="M354 111h-25l-26 15" fill="none" stroke="#40564d" />
            <text x="64" y="419">
              PAIR 01
            </text>
            <text x="216" y="447">
              PAIR 02
            </text>
            <text x="366" y="419">
              PAIR 03
            </text>
          </g>
        </svg>
      </div>
      <figcaption>
        <div>
          <Fingerprint />
          <span>One fixed candidate.</span>
        </div>
        <p>Three environments. Every result on record.</p>
      </figcaption>
      <div className="visual-legend" aria-hidden="true">
        <span>
          <i /> BASELINE
        </span>
        <span>
          <i /> CANDIDATE
        </span>
      </div>
    </figure>
  );
}

const STEPS = [
  [
    Code,
    "01",
    "Inspect the source",
    "A persistent agent, grounded in your code.",
  ],
  [
    Stack,
    "02",
    "Freeze the candidate",
    "One fingerprint ties the patch to its evidence.",
  ],
  [
    TestTube,
    "03",
    "Measure both revisions",
    "Paired runs. Fixed checks. A recorded verdict.",
  ],
];

export function ProcessStrip() {
  return (
    <div className="process-strip" aria-label="How verification works">
      {STEPS.map(([Icon, number, title, copy]) => (
        <div className="process-step" data-reveal key={number}>
          <span className="process-icon">
            <Icon />
          </span>
          <div>
            <small>{number} / WORKFLOW</small>
            <h2>{title}</h2>
            <p>{copy}</p>
          </div>
          <ArrowRight className="process-arrow" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

export function PageGraphic({ variant }) {
  if (!variant) return null;
  return (
    <div
      className={`page-graphic motion-scene graphic-${variant}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 300 130" fill="none">
        <path
          d="M0 110h300M0 80h300M0 50h300M30 20v110M90 20v110M150 20v110M210 20v110M270 20v110"
          stroke="#446077"
          strokeOpacity=".14"
        />
        {variant === "sessions" && (
          <>
            <path
              className="graphic-trace"
              d="M15 104h55l23-27h86l25-36h79"
              stroke="#b4fb5a"
              strokeOpacity=".45"
            />
            {[0, 1, 2].map((n) => (
              <g
                key={n}
                className="graphic-float"
                style={{ "--node-delay": `${n * -2}s` }}
              >
                <rect
                  x={26 + n * 78}
                  y={59 - n * 18}
                  width="72"
                  height="48"
                  rx="5"
                  fill="#0c1c28"
                  stroke={n === 2 ? "#8bbf65" : "#3c5567"}
                />
                <circle
                  cx={39 + n * 78}
                  cy={73 - n * 18}
                  r="3"
                  fill={n === 2 ? "#b4fb5a" : "#7d9cae"}
                />
                <path
                  d={`M${50 + n * 78} ${73 - n * 18}h31m-42 12h43m-43 8h27`}
                  stroke="#73939f"
                  strokeOpacity=".6"
                />
              </g>
            ))}
          </>
        )}
        {variant === "benchmarks" && (
          <>
            {[37, 73, 53, 83, 62, 90, 71, 97, 82].map((height, n) => (
              <g
                key={n}
                className="graphic-bar"
                style={{ "--node-delay": `${n * -0.38}s` }}
              >
                <rect
                  x={25 + n * 29}
                  y={110 - height}
                  width="7"
                  height={height}
                  rx="2"
                  fill="#678aa2"
                  fillOpacity=".45"
                />
                <rect
                  x={35 + n * 29}
                  y={110 - height * 0.7}
                  width="7"
                  height={height * 0.7}
                  rx="2"
                  fill="#b4fb5a"
                  fillOpacity=".72"
                />
              </g>
            ))}
            <path
              className="graphic-trace"
              d="m27 68 31-25 29 12 30-24 30 7 31-21 30 9 30-15 26 3"
              stroke="#b4fb5a"
              strokeWidth="1.2"
            />
          </>
        )}
        {variant === "evidence" && (
          <>
            {[0, 1, 2].map((n) => (
              <g
                key={n}
                className="graphic-float"
                style={{ "--node-delay": `${n * -1.8}s` }}
              >
                <path
                  d={`m91 ${82 - n * 22} 67-33 67 33-67 33Z`}
                  fill="#0c202a"
                  stroke={n === 2 ? "#9bcd7b" : "#486577"}
                />
                <path
                  d={`m120 ${79 - n * 22} 38-19 33 16m-59 9 27 13 25-12`}
                  stroke="#95bca0"
                  strokeOpacity=".6"
                />
              </g>
            ))}
            <path
              d="M39 72h28m167-22h28M52 59v26m196-49v28"
              stroke="#648677"
              strokeOpacity=".5"
            />
          </>
        )}
        {variant === "connections" && (
          <>
            <path d="M45 65h66m78 0h66M150 39V13m0 104V91" stroke="#4b7166" />
            <path
              className="signal-flow"
              d="M45 65h66m78 0h66"
              stroke="#b4fb5a"
              strokeWidth="2"
            />
            {[45, 150, 255].map((x, n) => (
              <g
                key={x}
                className="graphic-float"
                style={{ "--node-delay": `${n * -2}s` }}
              >
                <rect
                  x={x - (n === 1 ? 31 : 20)}
                  y={n === 1 ? 34 : 45}
                  width={n === 1 ? 62 : 40}
                  height={n === 1 ? 62 : 40}
                  rx="10"
                  fill="#102329"
                  stroke={n === 1 ? "#93c779" : "#486577"}
                />
                <path d={`M${x - 7} 60h14m-14 10h14`} stroke="#b4fb5a" />
              </g>
            ))}
          </>
        )}
      </svg>
    </div>
  );
}

export function ConnectionVisual({ ready }) {
  return (
    <div
      className={`connection-visual motion-scene ${ready ? "is-configured" : ""}`}
      aria-label="Model and sandbox connections through AgenticRocket"
    >
      <div className="connection-endpoint">
        <Code />
        <span>Model</span>
        <small>REASONING</small>
      </div>
      <div className="connection-wire" aria-hidden="true">
        <i />
      </div>
      <div className="connection-hub">
        <Stack />
        <span>AgenticRocket</span>
        <small>ORCHESTRATION</small>
      </div>
      <div className="connection-wire" aria-hidden="true">
        <i />
      </div>
      <div className="connection-endpoint">
        <TestTube />
        <span>Daytona</span>
        <small>EXECUTION</small>
      </div>
    </div>
  );
}
