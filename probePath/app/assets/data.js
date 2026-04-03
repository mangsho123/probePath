export const SYMPTOMS = [
  { id: 'no-output', label: 'No output', shortLabel: 'No output', description: 'The expected signal or switched load never appears.' },
  { id: 'voltage-too-low', label: 'Voltage too low', shortLabel: 'Low voltage', description: 'A rail or node sits below the value you expected.' },
  { id: 'unstable-signal', label: 'Unstable signal', shortLabel: 'Unstable', description: 'The output rings, clips, or behaves inconsistently.' },
  { id: 'led-not-turning-on', label: 'LED not turning on', shortLabel: 'LED off', description: 'The LED should light, but it stays dark.' },
  { id: 'mcu-resets', label: 'MCU resets', shortLabel: 'MCU resets', description: 'The microcontroller restarts under load or at startup.' },
  { id: 'sensor-reading-incorrect', label: 'Sensor reading incorrect', shortLabel: 'Bad reading', description: 'The measured value is offset, stuck, or does not track reality.' }
,
  {
    id: 'mosfet-switch',
    name: 'MOSFET Switch',
    shortLabel: 'MOSFET',
    category: 'Switching',
    description: 'A low-side MOSFET switches a load such as a fan, strip, or small actuator.',
    supportedSymptoms: ['no-output'],
    badge: 'Load switching',
    caution: 'Assumes an N-channel low-side switch with the load tied to the positive rail.',
    expectedNodes: [
      { label: 'Load supply', value: 'Matches the intended source' },
      { label: 'Gate drive', value: 'Clearly above threshold when on' },
      { label: 'Drain', value: 'Drops near ground when on' }
    ],
    diagram: {
      width: 560,
      height: 240,
      blocks: [
        { id: 'supply', x: 40, y: 80, w: 90, h: 44, label: 'V+', subLabel: 'Load rail' },
        { id: 'load', x: 178, y: 80, w: 110, h: 44, label: 'LOAD', subLabel: 'Lamp or motor' },
        { id: 'drain', x: 326, y: 80, w: 90, h: 44, label: 'DRAIN', subLabel: 'Q1 drain' },
        { id: 'gate', x: 176, y: 150, w: 96, h: 30, label: 'Gate R', subLabel: 'Drive path' },
        { id: 'ctrl', x: 44, y: 144, w: 88, h: 42, label: 'CTRL', subLabel: 'MCU pin' },
        { id: 'q1', x: 326, y: 146, w: 90, h: 40, label: 'Q1', subLabel: 'N-MOSFET' }
      ],
      wires: [
        { x1: 130, y1: 102, x2: 178, y2: 102 },
        { x1: 288, y1: 102, x2: 326, y2: 102 },
        { x1: 372, y1: 124, x2: 372, y2: 146 },
        { x1: 132, y1: 165, x2: 176, y2: 165 },
        { x1: 272, y1: 165, x2: 326, y2: 165 }
      ]
    },
    testPoints: [
      { id: 'mosfet-supply', label: 'TP1 Load supply', short: 'Load supply', expected: 'Near the intended rail', x: 84, y: 68 },
      { id: 'mosfet-gate', label: 'TP2 Gate drive', short: 'Gate', expected: '3 V to 10 V depending on design', x: 220, y: 136 },
      { id: 'mosfet-drain', label: 'TP3 Drain', short: 'Drain', expected: 'Near 0 V when on', x: 372, y: 68 },
      { id: 'mosfet-source', label: 'TP4 Source', short: 'Source', expected: 'Near ground', x: 404, y: 206 }
    ],
    scenarios: {
      'no-output': {
        title: 'The MOSFET-switched load never turns on',
        narrative: 'Check the load rail, then the gate, then whether the MOSFET actually pulls the drain down.',
        prep: ['Trigger the load the same way it fails in normal use.', 'If this is a 3.3 V system, confirm the MOSFET is logic-level.'],
        faults: [
          { id: 'mosfet-no-gate', label: 'Gate drive never reaches a usable level', description: 'The MOSFET stays off if the gate never rises high enough above the source.', baseScore: 36, fixes: ['Verify the control signal and gate resistor path.', 'Use a logic-level MOSFET if driving from 3.3 V logic.'] },
          { id: 'mosfet-drain-path', label: 'Load or drain path is open', description: 'The source rail and gate look fine, but current never reaches the load path.', baseScore: 30, fixes: ['Check the load wiring from the positive rail to the drain.', 'Inspect connectors and the load itself for an open connection.'] },
          { id: 'mosfet-pinout', label: 'MOSFET pinout or grounding is wrong', description: 'A miswired source and drain or floating source can leave the load dead.', baseScore: 26, fixes: ['Check the MOSFET package pin order.', 'Tie the source solidly to ground and reduce jumper resistance.'] }
        ],
        steps: [
          {
            id: 'mosfet-supply',
            testPointId: 'mosfet-supply',
            title: 'Measure the load supply rail',
            question: 'What supply voltage reaches the load side?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '12.0',
            expected: { min: 11.2, max: 12.6, healthy: 'The load rail is present.', low: 'A missing or weak load rail will look exactly like a dead MOSFET.' },
            guide: ['Measure at the load, not only at the power supply terminals.'],
            tooltip: 'This rules out the simple case where the load never gets a source rail.',
            scoring: [
              { faultId: 'mosfet-drain-path', when: 'lt', value: 10.8, score: 20, note: 'The load-side supply is already weak or missing.' }
            ]
          },
          {
            id: 'mosfet-gate',
            testPointId: 'mosfet-gate',
            title: 'Measure the MOSFET gate drive',
            question: 'What gate voltage do you see when the load should be on?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '3.3',
            expected: { min: 3, max: 12, healthy: 'The gate is being driven to a believable on-state level.', low: 'A low gate voltage means the MOSFET never fully turns on.' },
            guide: ['Probe the gate pin directly if possible.'],
            tooltip: 'This is the most direct check for control-path problems.',
            scoring: [
              { faultId: 'mosfet-no-gate', when: 'lt', value: 2.5, score: 30, note: 'The gate never rises high enough to switch the MOSFET confidently.' },
              { faultId: 'mosfet-pinout', when: 'gte', value: 3, score: 8, note: 'Gate drive exists, so wiring becomes more plausible.' }
            ]
          },
          {
            id: 'mosfet-drain',
            testPointId: 'mosfet-drain',
            title: 'Measure the drain voltage while on',
            question: 'What drain voltage do you measure when the load should be on?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '0.2',
            expected: { max: 0.4, healthy: 'A low drain means the MOSFET is pulling the path down.', high: 'A high drain with good gate drive points to a pinout or ground issue.' },
            guide: ['Keep the circuit commanded on during the reading.'],
            tooltip: 'The drain confirms whether the switch actually closes the current path.',
            scoring: [
              { faultId: 'mosfet-pinout', when: 'gt', value: 3, score: 24, note: 'The drain never drops, which strongly fits a pinout or grounding problem.' },
              { faultId: 'mosfet-drain-path', when: 'lt', value: 0.4, score: 10, note: 'The switch is working, so the remaining issue likely sits in the load path.' }
            ]
          },
          {
            id: 'mosfet-source',
            testPointId: 'mosfet-source',
            title: 'Measure the source voltage',
            question: 'What source voltage do you measure relative to ground?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '0.0',
            expected: { max: 0.1, healthy: 'The source is solidly referenced to ground.', high: 'A raised source steals gate-to-source drive.' },
            guide: ['Probe the source pin directly rather than a distant ground point.'],
            tooltip: 'This catches floating or poorly grounded source connections.',
            scoring: [
              { faultId: 'mosfet-pinout', when: 'gt', value: 0.2, score: 18, note: 'The source is not really at ground, so the effective gate drive is reduced.' }
            ]
          }
        ]
      }
    }
  },
  {
    id: 'op-amp-amplifier',
    name: 'Simple Op-Amp Amplifier',
    shortLabel: 'Op-amp',
    category: 'Analog Signal Chain',
    description: 'A single op-amp stage boosts or buffers a small signal.',
    supportedSymptoms: ['unstable-signal'],
    badge: 'Scope optional',
    caution: 'Use this for a simple single-stage amplifier, not a complex filter or instrumentation amp.',
    expectedNodes: [
      { label: 'Positive rail', value: 'Matches the intended op-amp supply' },
      { label: 'Output swing', value: 'Stays inside the headroom limits' },
      { label: 'Bias point', value: 'Stable and near mid-rail on single-supply designs' }
    ],
    diagram: {
      width: 560,
      height: 240,
      blocks: [
        { id: 'input', x: 44, y: 94, w: 90, h: 38, label: 'VIN', subLabel: 'Signal source' },
        { id: 'net', x: 180, y: 84, w: 100, h: 58, label: 'Rin / Rf', subLabel: 'Gain set' },
        { id: 'amp', x: 322, y: 76, w: 116, h: 74, label: 'OP-AMP', subLabel: 'Amplifier stage' },
        { id: 'out', x: 470, y: 94, w: 72, h: 38, label: 'VOUT', subLabel: 'Output' },
        { id: 'rail', x: 322, y: 164, w: 116, h: 34, label: 'V+ / GND', subLabel: 'Rails' }
      ],
      wires: [
        { x1: 134, y1: 113, x2: 180, y2: 113 },
        { x1: 280, y1: 113, x2: 322, y2: 113 },
        { x1: 438, y1: 113, x2: 470, y2: 113 },
        { x1: 380, y1: 150, x2: 380, y2: 164 }
      ]
    },
    testPoints: [
      { id: 'opamp-rail', label: 'TP1 Positive rail', short: 'V+ rail', expected: 'About 5 V', x: 380, y: 208 },
      { id: 'opamp-input', label: 'TP2 Input amplitude', short: 'Input', expected: 'Known source level', x: 88, y: 82 },
      { id: 'opamp-output', label: 'TP3 Output amplitude', short: 'Output', expected: 'Clean amplified signal', x: 506, y: 82 },
      { id: 'opamp-offset', label: 'TP4 Output DC offset', short: 'DC offset', expected: 'Near intended bias point', x: 506, y: 146 }
    ],
    scenarios: {
      'unstable-signal': {
        title: 'Amplifier output is unstable or clipping',
        narrative: 'Start with the rail, compare input and output amplitude, then inspect the DC output bias.',
        prep: ['Use a scope if you have one, but a meter still helps for this MVP.', 'Keep the input source at the same level that causes the bad behavior.'],
        faults: [
          { id: 'opamp-headroom', label: 'The op-amp is running out of headroom', description: 'The rail or bias point does not leave enough room for the intended output swing.', baseScore: 34, fixes: ['Reduce gain or signal amplitude.', 'Bias the signal around mid-rail or raise the supply if the part allows it.'] },
          { id: 'opamp-feedback', label: 'Feedback network is wrong', description: 'The resistor network around the op-amp is not setting the intended closed-loop gain.', baseScore: 30, fixes: ['Verify the feedback resistor values and where they land.', 'Inspect for swapped input and feedback resistors.'] },
          { id: 'opamp-supply-noise', label: 'Supply decoupling is weak', description: 'A noisy or poorly bypassed rail can make a simple amplifier ring or misbehave.', baseScore: 26, fixes: ['Add or re-seat the local bypass capacitor.', 'Shorten the power and ground path around the stage.'] }
        ],
        steps: [
          {
            id: 'opamp-rail',
            testPointId: 'opamp-rail',
            title: 'Measure the op-amp positive rail',
            question: 'What supply voltage reaches the op-amp?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '5.0',
            expected: { min: 4.8, max: 5.2, healthy: 'The rail is present.', low: 'A weak rail makes clipping and instability much more likely.' },
            guide: ['Probe as close to the op-amp supply pin as you can.'],
            tooltip: 'The op-amp can only behave as well as the rail arriving at its pins.',
            scoring: [
              { faultId: 'opamp-headroom', when: 'lt', value: 4.6, score: 22, note: 'The supply rail is lower than expected, reducing output headroom.' },
              { faultId: 'opamp-supply-noise', when: 'between', min: 4.6, max: 4.8, score: 12, note: 'A marginal rail suggests a supply path or decoupling issue.' }
            ]
          },
          {
            id: 'opamp-input',
            testPointId: 'opamp-input',
            title: 'Measure the input signal amplitude',
            question: 'What input amplitude are you feeding into the op-amp?',
            instrument: 'Scope or meter',
            unit: 'V',
            placeholder: '0.2',
            expected: { min: 0.05, max: 0.3, healthy: 'The input is in a reasonable range.', high: 'A large input can push the stage into clipping even if it is wired correctly.' },
            guide: ['Enter the peak or approximate signal amplitude you care about.'],
            tooltip: 'This keeps you from chasing instability that is really just clipping from too much input.',
            scoring: [
              { faultId: 'opamp-headroom', when: 'gt', value: 0.35, score: 18, note: 'The input signal is large enough to push the amplifier toward clipping.' }
            ]
          },
          {
            id: 'opamp-output',
            testPointId: 'opamp-output',
            title: 'Measure the output amplitude',
            question: 'What output amplitude do you actually observe?',
            instrument: 'Scope or meter',
            unit: 'V',
            placeholder: '4.2',
            expected: { min: 0.3, max: 3.8, healthy: 'The output swing looks believable.', low: 'A much smaller output than expected points to a gain problem.', high: 'An output banging into the rail suggests headroom trouble.' },
            guide: ['Capture the approximate swing you actually see.'],
            tooltip: 'Output swing tells you whether the stage is clipping or under-gaining.',
            scoring: [
              { faultId: 'opamp-headroom', when: 'gt', value: 4.1, score: 24, note: 'The output is crowding the rail, which fits a headroom issue.' },
              { faultId: 'opamp-feedback', when: 'lt', value: 0.25, score: 18, note: 'The output is much smaller than expected, which often comes from the wrong feedback ratio.' }
            ]
          },
          {
            id: 'opamp-offset',
            testPointId: 'opamp-offset',
            title: 'Measure the output DC offset',
            question: 'What DC output level do you see with the signal applied?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '2.5',
            expected: { min: 2, max: 3, healthy: 'A mid-rail bias leaves room for the signal to swing.', low: 'A bias too close to ground starves the negative swing.', high: 'A bias too high starves the positive swing.' },
            guide: ['Use DC mode and note the average output level.'],
            tooltip: 'The bias point is the clearest clue for headroom problems.',
            scoring: [
              { faultId: 'opamp-headroom', when: 'outside', min: 1.8, max: 3.2, score: 20, note: 'The output bias is off-center, so the signal is running out of room on one side.' },
              { faultId: 'opamp-supply-noise', when: 'between', min: 1.8, max: 3.2, score: 8, note: 'The bias point is close to reasonable, so local decoupling becomes a stronger suspect.' }
            ]
          }
        ]
      }
    }
  },
  {
    id: 'regulator-power-rail',
    name: 'Regulator / Power Rail Issue',
    shortLabel: 'Regulator',
    category: 'Power',
    description: 'A regulator creates a logic rail, but the output is low or collapses under load.',
    supportedSymptoms: ['voltage-too-low'],
    badge: 'Power integrity',
    caution: 'Use this for simple low-voltage LDO or buck debug, not high-power switchers.',
    expectedNodes: [
      { label: 'Regulator input', value: 'Above dropout and stable' },
      { label: 'Regulator output', value: 'Close to the target rail' },
      { label: 'Rail-to-ground resistance', value: 'Not shorted' }
    ],
    diagram: {
      width: 560,
      height: 240,
      blocks: [
        { id: 'source', x: 40, y: 92, w: 90, h: 44, label: 'VIN', subLabel: 'Source' },
        { id: 'reg', x: 196, y: 78, w: 118, h: 72, label: 'REGULATOR', subLabel: 'LDO or buck' },
        { id: 'rail', x: 392, y: 92, w: 108, h: 44, label: 'VOUT', subLabel: 'System rail' },
        { id: 'load', x: 392, y: 162, w: 108, h: 34, label: 'LOAD', subLabel: 'MCU / sensors' }
      ],
      wires: [
        { x1: 130, y1: 114, x2: 196, y2: 114 },
        { x1: 314, y1: 114, x2: 392, y2: 114 },
        { x1: 446, y1: 136, x2: 446, y2: 162 }
      ]
    },
    testPoints: [
      { id: 'reg-in', label: 'TP1 Reg input', short: 'Reg input', expected: 'Above dropout', x: 162, y: 102 },
      { id: 'reg-out-idle', label: 'TP2 Output idle', short: 'Output idle', expected: 'Near target rail', x: 446, y: 78 },
      { id: 'reg-out-load', label: 'TP3 Output under load', short: 'Output load', expected: 'Stays within spec', x: 446, y: 150 },
      { id: 'reg-short', label: 'TP4 Rail to ground', short: 'Rail resistance', expected: 'Not near 0 Ω', x: 334, y: 170 }
    ],
    scenarios: {
      'voltage-too-low': {
        title: 'The power rail is lower than it should be',
        narrative: 'Measure the regulator input, compare idle and loaded output, then rule out a short.',
        prep: ['Compare the rail at idle and while the load is active if you can.', 'Power off before switching to resistance mode.'],
        faults: [
          { id: 'reg-dropout', label: 'The regulator does not have enough input headroom', description: 'The input is too close to the target output, so the regulator falls out of regulation.', baseScore: 36, fixes: ['Raise the input voltage or choose a lower-dropout regulator.', 'Reduce cable and connector drop before the regulator.'] },
          { id: 'reg-overload', label: 'The rail is overloaded', description: 'The load is drawing more current than the regulator or source can provide comfortably.', baseScore: 30, fixes: ['Measure load current and compare it to the regulator rating.', 'Reduce current draw or upgrade the regulator.'] },
          { id: 'reg-short', label: 'The rail is partially shorted or poorly decoupled', description: 'A low resistance to ground or weak output capacitance drags the rail down.', baseScore: 24, fixes: ['Inspect for solder bridges or damaged ICs.', 'Check the output capacitor value and placement.'] }
        ],
        steps: [
          {
            id: 'reg-in',
            testPointId: 'reg-in',
            title: 'Measure the regulator input',
            question: 'What voltage reaches the regulator input?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '5.0',
            expected: { min: 4.2, max: 12, healthy: 'The regulator has believable input headroom.', low: 'A low input means the regulator cannot make its target rail reliably.' },
            guide: ['Measure at the input pin or the nearest input capacitor.'],
            tooltip: 'A bad input rail is the fastest explanation for a bad output rail.',
            scoring: [
              { faultId: 'reg-dropout', when: 'lt', value: 3.8, score: 28, note: 'The regulator input is too low to maintain the intended output.' }
            ]
          },
          {
            id: 'reg-out-idle',
            testPointId: 'reg-out-idle',
            title: 'Measure the output at light load',
            question: 'What output voltage do you see with little or no load?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '3.3',
            expected: { min: 3.2, max: 3.4, healthy: 'The regulator looks healthy at light load.', low: 'A low idle output points to dropout, wrong wiring, or a damaged regulator.' },
            guide: ['If possible, disconnect heavy loads for this reading.'],
            tooltip: 'This separates a bad regulator from a rail that only fails under heavy load.',
            scoring: [
              { faultId: 'reg-dropout', when: 'lt', value: 3.0, score: 18, note: 'The output is already low even without a strong load.' },
              { faultId: 'reg-short', when: 'between', min: 3.0, max: 3.2, score: 12, note: 'A slightly low idle rail can come from poor output stability or a downstream drag.' }
            ]
          },
          {
            id: 'reg-out-load',
            testPointId: 'reg-out-load',
            title: 'Measure the output under the failing load',
            question: 'How low does the regulator output dip under load?',
            instrument: 'Multimeter or scope',
            unit: 'V',
            placeholder: '2.9',
            expected: { min: 3.1, max: 3.4, healthy: 'The rail stays in regulation under the expected load.', low: 'A big droop under load points to overload or poor decoupling.' },
            guide: ['Recreate the exact load event that causes the issue.'],
            tooltip: 'This step makes load-related failures obvious.',
            scoring: [
              { faultId: 'reg-overload', when: 'lt', value: 3.0, score: 24, note: 'The rail collapses once the load comes on, which fits overload or source sag.' },
              { faultId: 'reg-short', when: 'between', min: 3.0, max: 3.1, score: 16, note: 'A smaller droop often points to insufficient output decoupling or a partial short.' }
            ]
          },
          {
            id: 'reg-short',
            testPointId: 'reg-short',
            title: 'Power off and measure rail-to-ground resistance',
            question: 'What resistance do you measure from the output rail to ground?',
            instrument: 'Multimeter in resistance mode',
            unit: 'Ω',
            placeholder: '220',
            expected: { min: 100, healthy: 'The rail is not obviously shorted.', low: 'A low resistance points to a partial short or a very heavy load.' },
            guide: ['Remove power first, then isolate sections of the rail if needed.'],
            tooltip: 'This is the quickest way to catch a rail that is simply being dragged down.',
            scoring: [
              { faultId: 'reg-short', when: 'lt', value: 25, score: 30, note: 'The rail reads almost shorted to ground.' },
              { faultId: 'reg-overload', when: 'between', min: 25, max: 100, score: 12, note: 'The rail is not a hard short, but the low resistance still suggests a heavy downstream load.' }
            ]
          }
        ]
      }
    }
  }
,
  {
    id: 'mcu-motor-brownout',
    name: 'MCU + Motor Brownout',
    shortLabel: 'MCU + motor',
    category: 'Power Integrity',
    description: 'A battery, regulator, microcontroller, and motor share a power path and the MCU resets when the motor starts.',
    supportedSymptoms: ['mcu-resets'],
    badge: 'Featured demo',
    caution: 'This MVP focuses on low-voltage robot and maker builds where motor inrush disturbs the logic rail.',
    expectedNodes: [
      { label: 'Battery under load', value: 'Stays above 6.5 V in this 2S example' },
      { label: 'Regulator input', value: 'Tracks battery with only a small drop' },
      { label: '3.3 V rail dip', value: 'Never drops below about 3.0 V' },
      { label: 'Ground delta', value: 'Less than 80 mV between MCU ground and motor return' }
    ],
    diagram: {
      width: 560,
      height: 250,
      blocks: [
        { id: 'battery', x: 36, y: 88, w: 94, h: 48, label: 'BATTERY', subLabel: '2S pack' },
        { id: 'regulator', x: 176, y: 80, w: 108, h: 64, label: 'REGULATOR', subLabel: '5 V -> 3.3 V' },
        { id: 'mcu', x: 324, y: 52, w: 92, h: 48, label: 'MCU', subLabel: '3.3 V rail' },
        { id: 'driver', x: 324, y: 144, w: 92, h: 48, label: 'DRIVER', subLabel: 'MOSFET bridge' },
        { id: 'motor', x: 456, y: 144, w: 78, h: 48, label: 'MOTOR', subLabel: 'Load' }
      ],
      wires: [
        { x1: 130, y1: 112, x2: 176, y2: 112 },
        { x1: 284, y1: 92, x2: 324, y2: 76 },
        { x1: 284, y1: 132, x2: 324, y2: 168 },
        { x1: 416, y1: 168, x2: 456, y2: 168 },
        { x1: 82, y1: 136, x2: 82, y2: 214 },
        { x1: 82, y1: 214, x2: 500, y2: 214 }
      ]
    },
    testPoints: [
      { id: 'battery-load', label: 'TP1 Battery under load', short: 'Battery', expected: '6.5 V to 8.4 V', x: 84, y: 72 },
      { id: 'regulator-input', label: 'TP2 Regulator input', short: 'Reg input', expected: 'Near battery voltage', x: 230, y: 66 },
      { id: 'rail-dip', label: 'TP3 3.3 V rail dip', short: '3.3 V rail', expected: 'Above 3.0 V', x: 370, y: 38 },
      { id: 'ground-bounce', label: 'TP4 Ground delta', short: 'Ground delta', expected: 'Below 0.08 V', x: 398, y: 228 }
    ],
    scenarios: {
      'mcu-resets': {
        title: 'Why does my microcontroller reset when the motor starts?',
        narrative: 'Trace the power path from battery to logic rail during the first motor surge so you can separate true supply sag from layout-induced noise.',
        prep: ['Trigger the motor exactly the way it fails in normal use.', 'If you have a scope, probe the 3.3 V rail close to the MCU and capture the minimum dip.'],
        faults: [
          { id: 'brownout-supply-sag', label: 'The supply cannot source the motor inrush', description: 'Battery or upstream source current capability is too low, so voltage collapses when the motor starts.', baseScore: 40, fixes: ['Use a source with lower internal resistance or higher surge current capability.', 'Ramp motor current at startup instead of hitting full duty instantly.'] },
          { id: 'brownout-bulk-cap', label: 'Local bulk capacitance is missing or too small', description: 'The motor surge steals charge faster than the regulator and local rail can recover.', baseScore: 34, fixes: ['Add bulk capacitance near the motor driver and local decoupling near the MCU rail.', 'Keep capacitor return paths short and tied close to the load and regulator.'] },
          { id: 'brownout-ground-path', label: 'Ground or power return path is shared and noisy', description: 'Motor current is disturbing the MCU reference through shared copper, breadboard rails, or long jumpers.', baseScore: 30, fixes: ['Separate motor return current from the MCU ground path.', 'Use a star ground or a cleaner shared return point near the source.'] },
          { id: 'brownout-reg-headroom', label: 'The regulator loses headroom during startup', description: 'The regulator input dips enough that the 3.3 V rail cannot stay in regulation.', baseScore: 26, fixes: ['Raise regulator input headroom or choose a regulator better suited for transients.', 'Reduce cable and connector drop between the battery and regulator.'] }
        ],
        steps: [
          {
            id: 'battery-load',
            testPointId: 'battery-load',
            title: 'Measure the battery during motor startup',
            question: 'What is the lowest battery voltage you see when the motor first starts?',
            instrument: 'Multimeter or scope',
            unit: 'V',
            placeholder: '6.0',
            expected: { min: 6.5, max: 8.4, healthy: 'The battery stays reasonably stiff.', low: 'A deep battery dip means the source itself is struggling with inrush.' },
            guide: ['Use min/max capture if your multimeter supports it.'],
            tooltip: 'This is the fastest split between a weak source and a local layout problem.',
            scoring: [
              { faultId: 'brownout-supply-sag', when: 'lt', value: 6.2, score: 28, note: 'The battery collapses hard as soon as the motor hits inrush.' },
              { faultId: 'brownout-bulk-cap', when: 'between', min: 6.2, max: 6.8, score: 14, note: 'The source is only borderline, so local energy storage becomes important.' },
              { faultId: 'brownout-ground-path', when: 'gte', value: 6.8, score: 8, note: 'The battery looks relatively stable, so suspect downstream path sharing.' }
            ]
          },
          {
            id: 'regulator-input',
            testPointId: 'regulator-input',
            title: 'Measure the regulator input during the same event',
            question: 'How low does the regulator input fall when the motor starts?',
            instrument: 'Multimeter or scope',
            unit: 'V',
            placeholder: '5.8',
            expected: { min: 6.2, max: 8.2, healthy: 'The regulator still has believable headroom.', low: 'A low regulator input means cable drop or source sag is starving the 3.3 V rail.' },
            guide: ['Probe at the regulator input pin or input capacitor.'],
            tooltip: 'This catches cable, connector, and breadboard drop between source and regulator.',
            scoring: [
              { faultId: 'brownout-reg-headroom', when: 'lt', value: 5.9, score: 26, note: 'The regulator input falls low enough to threaten 3.3 V regulation.' },
              { faultId: 'brownout-ground-path', when: 'between', min: 5.9, max: 6.3, score: 10, note: 'A modest input dip can still become a reset if the ground path is noisy.' }
            ]
          },
          {
            id: 'rail-dip',
            testPointId: 'rail-dip',
            title: 'Measure the 3.3 V rail close to the MCU',
            question: 'What is the lowest 3.3 V rail value you observe at the MCU during startup?',
            instrument: 'Scope or meter with min capture',
            unit: 'V',
            placeholder: '2.7',
            expected: { min: 3, max: 3.4, healthy: 'The MCU rail stays above a typical brownout threshold.', low: 'A dip below about 3.0 V makes a brownout reset very believable.' },
            guide: ['Probe at the MCU VCC pin or the nearest decoupling capacitor.'],
            tooltip: 'This is the measurement that confirms whether the reset is really a rail event.',
            scoring: [
              { faultId: 'brownout-bulk-cap', when: 'lt', value: 2.9, score: 24, note: 'The 3.3 V rail dips well below a comfortable operating range.' },
              { faultId: 'brownout-reg-headroom', when: 'lt', value: 2.9, score: 18, note: 'The regulator cannot hold the rail through the transient.' },
              { faultId: 'brownout-ground-path', when: 'between', min: 2.9, max: 3.05, score: 12, note: 'A small but real rail dip can still pair with noisy ground to trigger resets.' }
            ]
          },
          {
            id: 'ground-bounce',
            testPointId: 'ground-bounce',
            title: 'Measure the voltage between MCU ground and motor return',
            question: 'How much ground difference do you see during startup?',
            instrument: 'Scope or meter',
            unit: 'V',
            placeholder: '0.14',
            expected: { max: 0.08, healthy: 'The ground path is relatively quiet.', high: 'A large ground delta means shared return current is disturbing the MCU reference.' },
            guide: ['Measure between the MCU ground point and the motor current return path.'],
            tooltip: 'This is the tie-breaker between pure supply sag and layout-induced resets.',
            scoring: [
              { faultId: 'brownout-ground-path', when: 'gt', value: 0.1, score: 30, note: 'Ground bounce is large enough to corrupt the MCU reference during startup.' },
              { faultId: 'brownout-bulk-cap', when: 'between', min: 0.05, max: 0.1, score: 8, note: 'Ground movement is modest, so local capacitance still deserves attention.' }
            ]
          }
        ]
      }
    }
  },
  {
    id: 'sensor-adc-front-end',
    name: 'Sensor-to-ADC Front End',
    shortLabel: 'Sensor + ADC',
    category: 'Mixed Signal',
    description: 'A sensor output feeds an ADC through simple filtering or scaling, but the reading is wrong.',
    supportedSymptoms: ['sensor-reading-incorrect'],
    badge: 'Mixed-signal debug',
    caution: 'This MVP assumes a simple analog sensor path, not a digital protocol sensor.',
    expectedNodes: [
      { label: 'Sensor supply', value: 'Stable and close to the intended rail' },
      { label: 'Sensor output', value: 'Within the expected analog range' },
      { label: 'ADC pin', value: 'Matches the conditioned sensor output' },
      { label: 'ADC reference', value: 'Stable and known' }
    ],
    diagram: {
      width: 560,
      height: 240,
      blocks: [
        { id: 'supply', x: 40, y: 82, w: 88, h: 42, label: '3.3 V', subLabel: 'Sensor rail' },
        { id: 'sensor', x: 176, y: 72, w: 100, h: 62, label: 'SENSOR', subLabel: 'Analog output' },
        { id: 'filter', x: 320, y: 82, w: 86, h: 42, label: 'RC', subLabel: 'Filter / scale' },
        { id: 'adc', x: 448, y: 72, w: 86, h: 62, label: 'ADC', subLabel: 'MCU input' },
        { id: 'ref', x: 448, y: 154, w: 86, h: 32, label: 'VREF', subLabel: 'Reference' }
      ],
      wires: [
        { x1: 128, y1: 103, x2: 176, y2: 103 },
        { x1: 276, y1: 103, x2: 320, y2: 103 },
        { x1: 406, y1: 103, x2: 448, y2: 103 },
        { x1: 492, y1: 134, x2: 492, y2: 154 }
      ]
    },
    testPoints: [
      { id: 'sensor-supply', label: 'TP1 Sensor supply', short: 'Sensor rail', expected: '3.2 V to 3.4 V', x: 84, y: 68 },
      { id: 'sensor-output', label: 'TP2 Sensor output', short: 'Sensor out', expected: 'Within expected analog range', x: 226, y: 58 },
      { id: 'adc-pin', label: 'TP3 ADC pin', short: 'ADC pin', expected: 'Tracks conditioned sensor voltage', x: 492, y: 58 },
      { id: 'adc-ref', label: 'TP4 ADC reference', short: 'VREF', expected: 'Stable reference rail', x: 492, y: 200 }
    ],
    scenarios: {
      'sensor-reading-incorrect': {
        title: 'The sensor reading is incorrect',
        narrative: 'Confirm the sensor is powered, then compare the raw sensor output to the ADC pin and the reference rail.',
        prep: ['Put the sensor into a known condition before you probe it.', 'If the signal is filtered, wait for it to settle before recording the value.'],
        faults: [
          { id: 'sensor-supply-bad', label: 'The sensor is not powered correctly', description: 'A weak or missing sensor rail shifts every downstream reading.', baseScore: 34, fixes: ['Repair the sensor power rail and ground first.', 'Add local decoupling if the rail is noisy or distant.'] },
          { id: 'sensor-conditioning', label: 'The filter or scaling network is wrong', description: 'The voltage reaching the ADC does not match the intended conditioned sensor output.', baseScore: 30, fixes: ['Verify resistor and capacitor values in the conditioning network.', 'Check whether the ADC pin is loading the sensor path more than expected.'] },
          { id: 'sensor-reference', label: 'ADC reference is wrong or unstable', description: 'Even a correct input voltage reads wrong if the conversion reference is off.', baseScore: 26, fixes: ['Measure the ADC reference rail directly and compare it to firmware assumptions.', 'Stabilize or calibrate the reference path.'] },
          { id: 'sensor-ground', label: 'Sensor and ADC do not share a clean ground', description: 'Ground offset between the sensor and MCU changes the apparent reading.', baseScore: 22, fixes: ['Improve the shared analog ground return.', 'Keep sensor return current away from noisy digital or motor paths.'] }
        ],
        steps: [
          {
            id: 'sensor-supply',
            testPointId: 'sensor-supply',
            title: 'Measure the sensor supply rail',
            question: 'What voltage reaches the sensor power pin?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '3.3',
            expected: { min: 3.2, max: 3.4, healthy: 'The sensor rail looks healthy.', low: 'A low sensor rail will shift both the output and the ADC reading.' },
            guide: ['Measure at the sensor pins or the nearest bypass capacitor.'],
            tooltip: 'This protects you from debugging signal conditioning when the sensor is simply underpowered.',
            scoring: [
              { faultId: 'sensor-supply-bad', when: 'lt', value: 3.05, score: 28, note: 'The sensor rail is lower than it should be.' },
              { faultId: 'sensor-ground', when: 'between', min: 3.05, max: 3.2, score: 10, note: 'The rail is only a bit low, which can happen with a poor analog ground return.' }
            ]
          },
          {
            id: 'sensor-output',
            testPointId: 'sensor-output',
            title: 'Measure the raw sensor output',
            question: 'What analog voltage does the sensor output right now?',
            instrument: 'Multimeter or scope',
            unit: 'V',
            placeholder: '1.2',
            expected: { min: 0.8, max: 1.6, healthy: 'The raw sensor output looks believable.', low: 'A low raw output can come from a bad sensor supply or sensor fault.', high: 'A high raw output can mean your bias or reference assumptions are wrong.' },
            guide: ['Probe the sensor output before any divider or filter network.'],
            tooltip: 'This distinguishes a sensor problem from an ADC-conditioning problem.',
            scoring: [
              { faultId: 'sensor-supply-bad', when: 'lt', value: 0.6, score: 16, note: 'The raw sensor output is very low, which matches an underpowered sensor.' },
              { faultId: 'sensor-conditioning', when: 'between', min: 0.8, max: 1.6, score: 8, note: 'The raw sensor output looks reasonable, so compare it to the ADC pin next.' }
            ]
          },
          {
            id: 'adc-pin',
            testPointId: 'adc-pin',
            title: 'Measure the ADC input pin voltage',
            question: 'What voltage actually reaches the ADC pin?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '0.7',
            expected: { min: 0.8, max: 1.6, healthy: 'The ADC pin tracks the expected analog range.', low: 'A lower ADC pin voltage than the raw sensor output suggests conditioning or loading trouble.', high: 'A higher ADC pin voltage than expected can mean scaling is wrong.' },
            guide: ['Probe the ADC pin directly if the board layout allows it.'],
            tooltip: 'This is the key comparison for finding a bad filter, divider, or loading issue.',
            scoring: [
              { faultId: 'sensor-conditioning', when: 'lt', value: 0.7, score: 24, note: 'The ADC input is much lower than expected, which fits a bad conditioning network.' },
              { faultId: 'sensor-ground', when: 'between', min: 0.7, max: 0.8, score: 12, note: 'A slightly low ADC pin can happen when analog ground is shifting.' }
            ]
          },
          {
            id: 'adc-ref',
            testPointId: 'adc-ref',
            title: 'Measure the ADC reference rail',
            question: 'What reference voltage is the ADC using?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '3.3',
            expected: { min: 3.2, max: 3.4, healthy: 'The ADC reference matches the likely firmware assumption.', low: 'A low reference skews the conversion.', high: 'A high reference can make the reading appear lower than expected.' },
            guide: ['Probe the actual VREF pin or reference rail used by the MCU.'],
            tooltip: 'This is the tie-breaker when the analog path looks fine but the digital reading is wrong.',
            scoring: [
              { faultId: 'sensor-reference', when: 'outside', min: 3.2, max: 3.4, score: 28, note: 'The ADC reference is not where you expect it to be.' },
              { faultId: 'sensor-ground', when: 'between', min: 3.15, max: 3.2, score: 8, note: 'A slightly low reference can also reflect a shared analog ground issue.' }
            ]
          }
        ]
      }
    }
  }
];

export const DEMO_CASES = [
  {
    id: 'demo-brownout',
    title: 'Why does my microcontroller reset when the motor starts?',
    subtitle: 'Featured demo',
    templateId: 'mcu-motor-brownout',
    symptomId: 'mcu-resets',
    story: 'Small robot on a 2S battery. The MCU reboots the moment the DC motor kicks.',
    presetMeasurements: { 'battery-load': 6.05, 'regulator-input': 5.72, 'rail-dip': 2.68, 'ground-bounce': 0.16 }
  },
  {
    id: 'demo-led-switch',
    title: 'LED indicator stays dark',
    subtitle: 'Quick win',
    templateId: 'led-transistor-switch',
    symptomId: 'led-not-turning-on',
    story: 'An MCU pin should light an LED through a transistor, but nothing happens.',
    presetMeasurements: { 'led-supply': 5.02, 'bjt-base': 0.09, 'bjt-collector': 4.88, 'led-drop': 0.03 }
  },
  {
    id: 'demo-regulator',
    title: '3.3 V rail droops under load',
    subtitle: 'Power path',
    templateId: 'regulator-power-rail',
    symptomId: 'voltage-too-low',
    story: 'A sensor board works at idle, then the rail falls when the radio turns on.',
    presetMeasurements: { 'reg-in': 4.85, 'reg-out-idle': 3.28, 'reg-out-load': 2.91, 'reg-short': 62 }
  },
  {
    id: 'demo-sensor',
    title: 'Analog sensor reading is way off',
    subtitle: 'Mixed signal',
    templateId: 'sensor-adc-front-end',
    symptomId: 'sensor-reading-incorrect',
    story: 'The sensor output looks plausible at the sensor, but firmware reports the wrong value.',
    presetMeasurements: { 'sensor-supply': 3.29, 'sensor-output': 1.24, 'adc-pin': 0.69, 'adc-ref': 3.31 }
  },
  {
    id: 'demo-opamp',
    title: 'Op-amp output clips and wanders',
    subtitle: 'Signal chain',
    templateId: 'op-amp-amplifier',
    symptomId: 'unstable-signal',
    story: 'A single-supply op-amp should amplify a small sensor signal, but the output keeps flattening.',
    presetMeasurements: { 'opamp-rail': 4.74, 'opamp-input': 0.42, 'opamp-output': 4.32, 'opamp-offset': 3.54 }
  }
];

export function findTemplate(templateId) {
  return CIRCUIT_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function findScenario(templateId, symptomId) {
  const template = findTemplate(templateId);

  if (!template) {
    return null;
  }

  return template.scenarios?.[symptomId] ?? null;
}

export function findSymptom(symptomId) {
  return SYMPTOMS.find((symptom) => symptom.id === symptomId) ?? null;
}

export const CIRCUIT_TEMPLATES = [
  {
    id: 'voltage-divider',
    name: 'Voltage Divider',
    shortLabel: 'Divider',
    category: 'Analog Basics',
    description: 'Two resistors create a scaled voltage for a reference or ADC input.',
    supportedSymptoms: ['voltage-too-low'],
    badge: 'Beginner friendly',
    caution: 'Best for low-current divider references and simple sensor scaling.',
    expectedNodes: [
      { label: 'Input rail', value: 'About 5 V' },
      { label: 'Midpoint', value: 'About 2.5 V for equal resistors' },
      { label: 'Top resistor', value: 'Matches the schematic value' }
    ],
    diagram: {
      width: 560,
      height: 240,
      blocks: [
        { id: 'vin', x: 40, y: 80, w: 90, h: 46, label: 'VIN', subLabel: 'Source' },
        { id: 'r1', x: 178, y: 72, w: 110, h: 30, label: 'R1', subLabel: 'Top leg' },
        { id: 'tap', x: 326, y: 82, w: 96, h: 40, label: 'VOUT', subLabel: 'Tap' },
        { id: 'r2', x: 178, y: 148, w: 110, h: 30, label: 'R2', subLabel: 'Bottom leg' },
        { id: 'gnd', x: 450, y: 156, w: 70, h: 40, label: 'GND', subLabel: '0 V' }
      ],
      wires: [
        { x1: 130, y1: 103, x2: 178, y2: 87 },
        { x1: 288, y1: 87, x2: 326, y2: 102 },
        { x1: 232, y1: 102, x2: 232, y2: 148 },
        { x1: 288, y1: 163, x2: 450, y2: 176 },
        { x1: 374, y1: 122, x2: 374, y2: 176 },
        { x1: 374, y1: 176, x2: 450, y2: 176 }
      ]
    },
    testPoints: [
      { id: 'divider-vin', label: 'TP1 Input rail', short: 'Input rail', expected: '4.8 V to 5.2 V', x: 84, y: 68 },
      { id: 'divider-vout', label: 'TP2 Midpoint', short: 'Midpoint', expected: '2.4 V to 2.6 V', x: 374, y: 68 },
      { id: 'divider-r1', label: 'TP3 Top resistor', short: 'Top resistor', expected: 'About 10 kΩ', x: 232, y: 56 }
    ],
    scenarios: {
      'voltage-too-low': {
        title: 'Divider output is lower than expected',
        narrative: 'Check the source, then the midpoint, then confirm the resistor that sets the ratio.',
        prep: ['Measure with the load attached.', 'Power off before using resistance mode.'],
        faults: [
          { id: 'divider-supply-low', label: 'Input rail is already low', description: 'The divider cannot output the right ratio from a bad source.', baseScore: 34, fixes: ['Fix the upstream source first.', 'Check the battery, USB rail, or regulator headroom.'] },
          { id: 'divider-heavy-load', label: 'The midpoint is being loaded down', description: 'A downstream circuit is pulling more current than the divider should source.', baseScore: 30, fixes: ['Buffer the divider if it drives a heavy input.', 'Lower divider impedance if power budget allows.'] },
          { id: 'divider-wrong-ratio', label: 'Wrong resistor value or open upper leg', description: 'A resistor value or connection does not match the intended ratio.', baseScore: 26, fixes: ['Check resistor values with a meter.', 'Reflow or replace the upper resistor leg.'] }
        ],
        steps: [
          {
            id: 'divider-vin',
            testPointId: 'divider-vin',
            title: 'Measure the divider input rail',
            question: 'What voltage reaches the divider input?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '5.0',
            expected: { min: 4.8, max: 5.2, healthy: 'The source looks normal.', low: 'A low source explains a low midpoint.' },
            guide: ['Probe VIN to ground with the circuit powered.'],
            tooltip: 'Start here so you do not blame the divider for a bad upstream rail.',
            scoring: [
              { faultId: 'divider-supply-low', when: 'lt', value: 4.75, score: 28, note: 'The source rail is already low.' },
              { faultId: 'divider-heavy-load', when: 'gte', value: 4.9, score: 4, note: 'Source looks healthy, so loading moves up the list.' }
            ]
          },
          {
            id: 'divider-vout',
            testPointId: 'divider-vout',
            title: 'Measure the midpoint voltage',
            question: 'What voltage do you see at the divider midpoint?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '2.5',
            expected: { min: 2.4, max: 2.6, healthy: 'The midpoint is near ideal.', low: 'A low midpoint suggests loading or the wrong ratio.', high: 'A high midpoint often means the bottom leg is wrong.' },
            guide: ['Measure the midpoint without moving the ground lead.'],
            tooltip: 'This separates source problems from ratio problems.',
            scoring: [
              { faultId: 'divider-heavy-load', when: 'lt', value: 2.2, score: 22, note: 'The midpoint is lower than a healthy divider should be.' },
              { faultId: 'divider-wrong-ratio', when: 'outside', min: 2.35, max: 2.65, score: 18, note: 'The measured ratio does not match an equal-resistor divider.' }
            ]
          },
          {
            id: 'divider-r1',
            testPointId: 'divider-r1',
            title: 'Power off and measure the upper resistor',
            question: 'What resistance do you measure for the upper resistor?',
            instrument: 'Multimeter in resistance mode',
            unit: 'kΩ',
            placeholder: '10',
            expected: { min: 9.5, max: 10.5, healthy: 'The resistor matches the intended value.', low: 'A smaller resistor shifts the divider ratio.', high: 'A very large reading fits an open resistor or broken joint.' },
            guide: ['Turn power off before switching modes.'],
            tooltip: 'This confirms whether the physical resistor matches the schematic.',
            scoring: [
              { faultId: 'divider-wrong-ratio', when: 'outside', min: 9.5, max: 10.5, score: 26, note: 'The top resistor does not match the intended divider ratio.' }
            ]
          }
        ]
      }
    }
  },
  {
    id: 'resistor-network',
    name: 'Resistor Network',
    shortLabel: 'Network',
    category: 'Passive Networks',
    description: 'A resistor ladder or pull-up network biases a shared logic or analog node.',
    supportedSymptoms: ['no-output'],
    badge: 'Good for breadboards',
    caution: 'Use this when a node is stuck high, stuck low, or never reaches the expected level.',
    expectedNodes: [
      { label: 'Logic rail', value: 'About 3.3 V' },
      { label: 'Output node', value: 'Reaches the intended state' },
      { label: 'Node-to-ground', value: 'Not hard-shorted' }
    ],
    diagram: {
      width: 560,
      height: 240,
      blocks: [
        { id: 'vcc', x: 42, y: 82, w: 88, h: 44, label: 'VCC', subLabel: 'Rail' },
        { id: 'r1', x: 180, y: 72, w: 104, h: 30, label: 'R1', subLabel: 'Pull-up' },
        { id: 'r2', x: 180, y: 148, w: 104, h: 30, label: 'R2', subLabel: 'Sense leg' },
        { id: 'node', x: 326, y: 82, w: 96, h: 40, label: 'NODE', subLabel: 'Output' },
        { id: 'load', x: 454, y: 82, w: 82, h: 40, label: 'LOAD', subLabel: 'Input pin' }
      ],
      wires: [
        { x1: 130, y1: 104, x2: 180, y2: 87 },
        { x1: 130, y1: 104, x2: 180, y2: 163 },
        { x1: 284, y1: 87, x2: 326, y2: 102 },
        { x1: 284, y1: 163, x2: 326, y2: 102 },
        { x1: 422, y1: 102, x2: 454, y2: 102 }
      ]
    },
    testPoints: [
      { id: 'network-vcc', label: 'TP1 Logic rail', short: 'Logic rail', expected: 'About 3.3 V', x: 86, y: 68 },
      { id: 'network-node', label: 'TP2 Output node', short: 'Output node', expected: 'Near the intended state', x: 374, y: 68 },
      { id: 'network-short', label: 'TP3 Node to ground', short: 'Node-to-ground', expected: 'Not near 0 Ω', x: 374, y: 150 }
    ],
    scenarios: {
      'no-output': {
        title: 'The resistor-network node is stuck or missing',
        narrative: 'Confirm the rail, then see if the node is pinned, then rule out a short.',
        prep: ['Decide what state the node should be in first.', 'Use resistance mode only with power removed.'],
        faults: [
          { id: 'network-rail-missing', label: 'Logic rail is missing', description: 'The network cannot create an output without its source rail.', baseScore: 32, fixes: ['Repair the missing logic rail.', 'Trace the rail back to its regulator or jumper.'] },
          { id: 'network-node-shorted', label: 'Output node is shorted or overloaded', description: 'A short or overly strong load keeps the node pinned.', baseScore: 30, fixes: ['Disconnect the downstream load and re-measure.', 'Inspect for solder bridges or breadboard mistakes.'] },
          { id: 'network-open-leg', label: 'One resistor leg is open or the value is wrong', description: 'The network cannot bias the node correctly if a resistor is missing or wrong.', baseScore: 26, fixes: ['Verify resistor placement and value.', 'Replace or reseat the suspect resistor.'] }
        ],
        steps: [
          {
            id: 'network-vcc',
            testPointId: 'network-vcc',
            title: 'Measure the logic rail feeding the network',
            question: 'What rail voltage reaches the network?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '3.3',
            expected: { min: 3.1, max: 3.5, healthy: 'The pull-up source looks present.', low: 'A weak logic rail can make the node look dead.' },
            guide: ['Measure at the resistor-network entry point.'],
            tooltip: 'This catches loose jumpers and broken breadboard rails quickly.',
            scoring: [
              { faultId: 'network-rail-missing', when: 'lt', value: 2.9, score: 30, note: 'The logic rail is too low or absent.' }
            ]
          },
          {
            id: 'network-node',
            testPointId: 'network-node',
            title: 'Measure the network output node',
            question: 'What voltage does the node sit at in the failing state?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '0.1',
            expected: { min: 2.8, max: 3.5, healthy: 'The node reaches a healthy high level.', low: 'A low node points to a short, heavy load, or open pull-up.' },
            guide: ['Probe the node while the downstream input is still attached.'],
            tooltip: 'The output node tells you whether the network is winning against the load.',
            scoring: [
              { faultId: 'network-node-shorted', when: 'lt', value: 0.25, score: 26, note: 'The node is pinned near ground.' },
              { faultId: 'network-open-leg', when: 'between', min: 0.25, max: 2.4, score: 18, note: 'The node rises a little but not enough, which fits a weak or open network leg.' }
            ]
          },
          {
            id: 'network-short',
            testPointId: 'network-short',
            title: 'Power off and measure node-to-ground resistance',
            question: 'What resistance do you measure from the node to ground?',
            instrument: 'Multimeter in resistance mode',
            unit: 'Ω',
            placeholder: '4700',
            expected: { min: 1000, healthy: 'The node is not hard-shorted.', low: 'A very low resistance means the node is being forced low.' },
            guide: ['Remove power before switching to resistance mode.'],
            tooltip: 'This confirms whether the node is hard-shorted.',
            scoring: [
              { faultId: 'network-node-shorted', when: 'lt', value: 50, score: 28, note: 'The node reads almost shorted to ground.' },
              { faultId: 'network-open-leg', when: 'gte', value: 1000, score: 6, note: 'The node is not hard-shorted, so an open leg becomes more plausible.' }
            ]
          }
        ]
      }
    }
  },
  {
    id: 'led-transistor-switch',
    name: 'LED + Transistor Switch',
    shortLabel: 'LED switch',
    category: 'Switching',
    description: 'A transistor sinks current for an LED indicator, but the LED never lights.',
    supportedSymptoms: ['led-not-turning-on'],
    badge: 'Great demo circuit',
    caution: 'Assumes a low-side NPN switch with the LED and resistor on the collector side.',
    expectedNodes: [
      { label: 'LED supply', value: 'Near 5 V' },
      { label: 'Base drive', value: 'About 0.7 V when on' },
      { label: 'Collector', value: 'Drops low when on' }
    ],
    diagram: {
      width: 560,
      height: 240,
      blocks: [
        { id: 'vplus', x: 40, y: 80, w: 86, h: 44, label: 'V+', subLabel: 'Rail' },
        { id: 'led', x: 170, y: 80, w: 106, h: 44, label: 'LED + R', subLabel: 'Series path' },
        { id: 'collector', x: 322, y: 80, w: 92, h: 44, label: 'COLL', subLabel: 'Q1 collector' },
        { id: 'base', x: 174, y: 150, w: 94, h: 30, label: 'Base R', subLabel: 'Drive' },
        { id: 'ctrl', x: 44, y: 144, w: 86, h: 42, label: 'CTRL', subLabel: 'MCU pin' },
        { id: 'q1', x: 322, y: 146, w: 92, h: 40, label: 'Q1', subLabel: 'NPN' }
      ],
      wires: [
        { x1: 126, y1: 102, x2: 170, y2: 102 },
        { x1: 276, y1: 102, x2: 322, y2: 102 },
        { x1: 368, y1: 124, x2: 368, y2: 146 },
        { x1: 130, y1: 165, x2: 174, y2: 165 },
        { x1: 268, y1: 165, x2: 322, y2: 165 }
      ]
    },
    testPoints: [
      { id: 'led-supply', label: 'TP1 LED supply', short: 'LED supply', expected: 'About 5 V', x: 84, y: 68 },
      { id: 'bjt-base', label: 'TP2 Base drive', short: 'Base', expected: '0.65 V to 0.9 V', x: 220, y: 136 },
      { id: 'bjt-collector', label: 'TP3 Collector', short: 'Collector', expected: 'Below 0.3 V when on', x: 368, y: 68 },
      { id: 'led-drop', label: 'TP4 LED drop', short: 'Across LED', expected: 'About 1.8 V to 2.2 V', x: 224, y: 58 }
    ],
    scenarios: {
      'led-not-turning-on': {
        title: 'LED should turn on, but stays dark',
        narrative: 'Confirm the LED path has supply, then see whether the transistor is driven and actually sinks current.',
        prep: ['Command the LED on while measuring.', 'Keep the black lead on ground and move along the current path.'],
        faults: [
          { id: 'bjt-no-base-drive', label: 'The transistor never gets base drive', description: 'The control pin or base resistor is not delivering turn-on drive.', baseScore: 36, fixes: ['Check the MCU output state and base resistor.', 'Make sure the control pin is configured as an output.'] },
          { id: 'bjt-led-path-open', label: 'The LED path is open or reversed', description: 'Current cannot flow because the LED, resistor, or wiring is open or backwards.', baseScore: 30, fixes: ['Verify LED polarity and resistor continuity.', 'Replace the LED if it shows no forward drop.'] },
          { id: 'bjt-wrong-pinout', label: 'Collector and emitter are swapped', description: 'A transistor with the wrong pin orientation never pulls the collector low correctly.', baseScore: 28, fixes: ['Check the transistor package pinout.', 'Rotate or rewire the transistor.'] }
        ],
        steps: [
          {
            id: 'led-supply',
            testPointId: 'led-supply',
            title: 'Measure the LED supply node',
            question: 'What voltage reaches the LED anode side?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '5.0',
            expected: { min: 4.7, max: 5.2, healthy: 'The LED path has a healthy source.', low: 'A weak or missing LED supply can keep the whole path dark.' },
            guide: ['Probe the anode side of the LED or series resistor.'],
            tooltip: 'This tells you whether current even has a chance to enter the LED path.',
            scoring: [
              { faultId: 'bjt-led-path-open', when: 'lt', value: 4.5, score: 12, note: 'The source path is already weak or missing.' }
            ]
          },
          {
            id: 'bjt-base',
            testPointId: 'bjt-base',
            title: 'Measure the transistor base voltage',
            question: 'What base voltage do you measure while the LED should be on?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '0.75',
            expected: { min: 0.65, max: 0.9, healthy: 'The transistor is receiving believable base drive.', low: 'A low base voltage means the transistor is never being asked to turn on.' },
            guide: ['Probe the transistor base, not just the MCU pin.'],
            tooltip: 'No base drive is the fastest explanation for a dark LED.',
            scoring: [
              { faultId: 'bjt-no-base-drive', when: 'lt', value: 0.55, score: 30, note: 'The base never reaches a turn-on voltage.' },
              { faultId: 'bjt-wrong-pinout', when: 'between', min: 0.65, max: 0.9, score: 8, note: 'Base drive exists, so a wiring issue becomes more plausible.' }
            ]
          },
          {
            id: 'bjt-collector',
            testPointId: 'bjt-collector',
            title: 'Measure the collector while commanded on',
            question: 'What collector voltage do you see while the LED should be lit?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '0.2',
            expected: { max: 0.3, healthy: 'A low collector means the transistor is pulling current as expected.', high: 'A high collector with good base drive points to a pinout or path problem.' },
            guide: ['Probe the collector with the LED still commanded on.'],
            tooltip: 'The collector tells you whether the transistor actually switched the load.',
            scoring: [
              { faultId: 'bjt-wrong-pinout', when: 'gt', value: 1.2, score: 26, note: 'The collector never drops, which fits a miswired transistor.' },
              { faultId: 'bjt-led-path-open', when: 'lt', value: 0.3, score: 12, note: 'The transistor is switching, so the remaining issue is likely in the LED path.' }
            ]
          },
          {
            id: 'led-drop',
            testPointId: 'led-drop',
            title: 'Measure the voltage across the LED',
            question: 'What forward voltage do you measure across the LED?',
            instrument: 'Multimeter',
            unit: 'V',
            placeholder: '1.9',
            expected: { min: 1.7, max: 2.3, healthy: 'A normal LED forward drop means current is likely flowing.', low: 'Near-zero drop points to no current or a short path around the LED.', high: 'A very high drop can mean the LED is open or reversed.' },
            guide: ['Place one probe on each LED lead while it is commanded on.'],
            tooltip: 'This is the tie-breaker between a switch problem and an LED-path problem.',
            scoring: [
              { faultId: 'bjt-led-path-open', when: 'lt', value: 0.2, score: 24, note: 'There is almost no forward drop across the LED.' },
              { faultId: 'bjt-led-path-open', when: 'gt', value: 2.6, score: 22, note: 'The LED shows an abnormally high drop, which fits an open or reversed LED.' }
            ]
          }
        ]
      }
    }
  }
];
