// Eight deterministic lessons. No evaluator, random fault selection or instructor UI.
const s=(id,es,en,check='observe',setup=null)=>({id,text:{es,en},check,setup});
export const lessons=[
{id:'assembly',title:{es:'Armar la cadena',en:'Assemble the chain'},scenario:'assembly',steps:[
s('screen','Con llave OFF, acerca el naranja al receptáculo principal del MK3. Alinea la ranura con X/Y/Z y pulsa Conectar. Se aseguran la cuña y los clips; el puerto cámara no participa.','With key OFF, bring orange to the MK3 main receptacle. Align the slot with X/Y/Z and press Connect. The wedge and clips are secured; the camera port is not used.','screenJoint'),
s('middle','Acerca las dos mitades de 4 pines. Alinea la esquina achaflanada y pulsa Conectar para asentar y asegurar el clip.','Bring both 4-pin halves together. Align the chamfered corner and press Connect to seat and secure the clip.','middleJoint'),
s('em','Acerca el circular al EM y alinea su muesca. Pulsa Conectar: en esta versión completa también el apriete de la rosca.','Bring the circular connector to the EM and align its notch. Press Connect: in this version it also fully tightens the thread.','emJoint'),
s('power','Pon la llave ON. Observa el arranque del MK3 y el verde parpadeando lento del EM: la cadena está alimentada y comunica.','Turn key ON. Observe MK3 startup and the slow blinking green EM LED: the chain has power and communicates.','keyOn') ]},
{id:'led',title:{es:'Leer el LED del Expansion Module',en:'Read the Expansion Module LED'},scenario:'healthy',steps:[
s('normal','Pon llave ON y mira el LED verde del EM. Parpadeo lento significa operación normal. Los otros dos LEDs permanecen apagados.','Turn key ON and look at the green EM LED. Slow blinking means normal operation. The other two LEDs remain off.','keyOn'),
s('off','Ejemplo preparado sin alimentación al EM: pon ON. LED apagado significa sin energía; revisa rojo y negro del arnés, no condenes el EM.','Prepared example with no EM supply: turn ON. An unlit LED means no power; check harness red and black, rather than condemning the EM.','keyOn','F1'),
s('steady','Ejemplo de EM trabado: pon ON y observa verde fijo. Primero intenta un reinicio; verde fijo no significa automáticamente quemado.','Frozen EM example: turn ON and observe steady green. Try a restart first; steady green does not automatically mean burnt out.','keyOn','F2'),
s('restartOff','Pon llave OFF para cortar la alimentación del módulo.','Turn key OFF to remove module power.','keyOff'),
s('restartOn','Pon ON otra vez. En este ejemplo el parpadeo lento regresa. Si el verde fijo persistiera, verifica especificaciones y conexiones antes de reemplazar.','Turn ON again. In this example slow blinking returns. If steady green persisted, verify specifications and connections before replacement.','restarted') ]},
{id:'voltage',title:{es:'Verificar alimentación con el multímetro',en:'Check supply with the multimeter'},scenario:'healthy',steps:[
s('key','Pon llave ON. Se esperan 12 V en rojo/negro hacia el EM. Los módulos trabajan entre 10 y 30 V DC; sobre 30 V requieren convertidor.','Turn key ON. Expect 12 V on red/black feeding the EM. Modules operate at 10–30 V DC; above 30 V a converter is required.','keyOn'),
s('mode','Elige Voltaje · V DC. Selecciona roja, acércala al pin 7 del EM y pulsa Conectar punta. Negra al pin 8, también Conectar punta.','Choose Voltage · V DC. Select red, approach EM pin 7 and press Connect probe. Place black on pin 8 and press Connect probe too.','voltage12'),
s('read','Usa Ver display: 12.0 V confirma alimentación entre Key Switched Positive y Ground. Una lectura negativa indica puntas invertidas. Retira ambas puntas.','Use View display: 12.0 V confirms supply between Key Switched Positive and Ground. A negative reading indicates reversed probes. Remove both probes.','probesFree'),
s('zero','Nuevo ejemplo: alimentación del EM interrumpida. Pon ON, selecciona Voltaje y conecta roja a pin 7 y negra a pin 8.','New example: interrupted EM supply. Turn ON, choose Voltage and connect red to pin 7 and black to pin 8.','voltage0','F1'),
s('interpret','0 V y LED apagado exigen revisar la alimentación por cables rojo/negro y sus conectores. No demuestran que el EM esté dañado. Retira las dos puntas.','0 V and an unlit LED call for checking red/black supply wires and connectors. They do not prove EM damage. Remove both probes.','probesFree') ]},
{id:'seating',title:{es:'Revisar el asentamiento de los conectores',en:'Check connector seating'},scenario:'healthy',steps:[
s('off','Pon llave OFF antes de desconectar. Revisarás las tres uniones, una por una.','Turn key OFF before disconnecting. Check all three joints, one at a time.','keyOff'),
s('screenOut','Selecciona la unión naranja/MK3 y pulsa Desconectar.','Select the orange/MK3 joint and press Disconnect.','screenOpen'),
s('screenIn','Acerca el naranja, alinea la ranura y vuelve a Conectar. La unión debe quedar asentada y asegurada.','Approach with orange, align the slot and Connect again. The joint must be seated and secured.','screenJoint'),
s('middleOut','Selecciona la unión media de 4 pines y pulsa Desconectar.','Select the middle 4-pin joint and press Disconnect.','middleOpen'),
s('middleIn','Alinea la esquina achaflanada y Conecta. El clip impide que las mitades se separen.','Align the chamfered corner and Connect. The clip prevents the halves separating.','middleJoint'),
s('emOut','Selecciona el circular del EM y pulsa Desconectar.','Select the EM circular connector and press Disconnect.','emOpen'),
s('emIn','Alinea la muesca y Conecta para completar la unión y el apriete de la rosca.','Align the notch and Connect to complete the joint and tighten the thread.','emJoint'),
s('check','Pon ON y observa pantalla y LED. Un asentamiento incompleto puede interrumpir CAN aunque el EM conserve alimentación.','Turn ON and observe screen and LED. Incomplete seating may interrupt CAN while EM power remains present.','keyOn') ]},
{id:'wires',title:{es:'Inspeccionar los cables naranja y café',en:'Inspect orange and brown wires'},scenario:'healthy',steps:[
s('off','Pon OFF. Café es Expansion CAN LO; naranja es Expansion CAN HI. Revisa ambos en todos los extremos, no por color solamente.','Turn OFF. Brown is Expansion CAN LO; orange is Expansion CAN HI. Check both at every endpoint, not by color alone.','keyOff'),
s('orange','Desconecta el naranja del MK3 e inspecciónalo con doble clic. Café: pin 9; naranja: pin 10. En hardware real se tira suavemente para comprobar el terminal.','Disconnect orange from MK3 and double-click to inspect it. Brown: pin 9; orange: pin 10. On real hardware gently pull the wire to check its terminal.','inspectOrange'),
s('upper','Desconecta la unión media e inspecciona su mitad superior con doble clic. Café: pin 3; naranja: pin 4. Busca cable o terminal flojo.','Disconnect the middle joint and double-click its upper half. Brown: pin 3; orange: pin 4. Look for loose wires or terminals.','inspectUpper'),
s('lower','Inspecciona con doble clic la mitad inferior de 4 pines. También café en pin 3 y naranja en pin 4.','Double-click the lower 4-pin half. Brown is also at pin 3 and orange at pin 4.','inspectLower'),
s('circular','Desconecta e inspecciona el circular. Café: pin 1; naranja CAN HI: pin 2. El naranja del pin 12 es Input 4 — Seat, no CAN HI.','Disconnect and inspect the circular. Brown: pin 1; orange CAN HI: pin 2. Orange at pin 12 is Input 4 — Seat, not CAN HI.','inspectCircular'),
s('repair','Esta versión permite inspeccionar, medir y sustituir el arnés completo; no extrae terminales ni simula tirar de un cable individual. Reconecta las tres uniones.','This version supports inspection, measurement and whole-harness replacement; it does not extract terminals or simulate tugging individual wires. Reconnect all three joints.','allJoints') ]},
{id:'continuity',title:{es:'Prueba de continuidad',en:'Continuity test'},scenario:'healthy',steps:[
s('off','Pon OFF y elige Continuidad. Primero comprueba extremo a extremo; PASA indica conductor continuo, NO PASA indica interrupción.','Turn OFF and choose Continuity. Check end to end first; PASS means a continuous conductor, NO PASS means an interruption.','continuityMode'),
s('endLo','Extremo a extremo, CAN LO: una punta en naranja pin 9 y otra en circular pin 1. Conecta ambas y lee el display.','End to end, CAN LO: one probe on orange pin 9, the other on circular pin 1. Connect both and read the display.','endLoPass'),
s('endHi','Retira y recoloca las puntas. CAN HI: naranja pin 10 → circular pin 2. Conecta ambas y lee.','Remove and reposition the probes. CAN HI: orange pin 10 → circular pin 2. Connect both and read.','endHiPass'),
s('skip','Ambos conductores pasan: aquí termina la prueba; no necesitas los dos tramos. Retira las puntas. Después verás un ejemplo distinto con una interrupción.','Both conductors pass: this test ends here; the two segment tests are unnecessary. Remove the probes. Next is a different example with an interruption.','probesFree'),
s('failed','Ejemplo nuevo con conductor interrumpido: llave OFF, Continuidad. Repite CAN LO extremo a extremo: naranja 9 → circular 1.','New example with an interrupted conductor: key OFF, Continuity. Repeat CAN LO end to end: orange 9 → circular 1.','endLoFail','F6'),
s('upper','Como NO PASA, mide primero pantalla → medio: naranja pin 9 → mitad superior de 4 pines pin 3. No empieces por el tramo inferior.','Since it does NOT PASS, first measure screen → middle: orange pin 9 → upper 4-pin half pin 3. Do not start with the lower segment.','upperLoPass'),
s('lower','Después EM → medio: circular pin 1 → mitad inferior de 4 pines pin 3. Retira y recoloca ambas puntas antes de medir.','Then EM → middle: circular pin 1 → lower 4-pin half pin 3. Remove and reposition both probes before measuring.','lowerLoFail'),
s('isolate','Superior PASA e inferior NO PASA: la interrupción está en el inferior. Para CAN HI, los equivalentes son 10 → 4 y 2 → 4. Repara o sustituye el tramo afectado; aquí se sustituye el arnés completo.','Upper PASS and lower NO PASS: the interruption is in the lower segment. For CAN HI, equivalents are 10 → 4 and 2 → 4. Repair or replace the affected segment; here replace the whole harness.') ]},
{id:'swap',title:{es:'Swap test',en:'Swap test'},scenario:'swap',steps:[
s('observe','Hay dos cadenas: vehículo con síntoma delante y vehículo de referencia detrás. Pon ON: una pantalla muestra la rueda y la otra arranca normal.','There are two chains: problem vehicle in front and reference vehicle behind. Turn ON: one screen spins and the other starts normally.','keyOn'),
s('voltage','Con llave ON, mide Voltaje: roja en pin 7 del circular delantero y negra en pin 8. Confirma 12 V antes de continuar.','With key ON, measure Voltage: red on front circular pin 7 and black on pin 8. Confirm 12 V before proceeding.','voltage12'),
s('lo','Comprueba CAN LO del vehículo con síntoma: naranja 9 → circular 1, en Continuidad con llave OFF.','Check CAN LO on the problem vehicle: orange 9 → circular 1, in Continuity with key OFF.','endLoPass'),
s('hi','Comprueba CAN HI: naranja 10 → circular 2. Ambas mediciones deben pasar antes de atribuir el síntoma a la pantalla.','Check CAN HI: orange 10 → circular 2. Both measurements must pass before attributing the symptom to the screen.','endHiPass'),
s('detach','Retira las puntas. Con llave OFF, desconecta los dos conectores naranja de sus pantallas: la sospechosa y la conocida buena.','Remove the probes. With key OFF, disconnect both orange connectors from their screens: suspect and known good.','swapOpen'),
s('move','Mueve la pantalla conocida buena al frente y la sospechosa hacia atrás. Arrastra sus cuerpos; no sustituyas el EM ni los arneses.','Move the known-good screen to the front and suspect screen to the back. Drag their bodies; do not replace EM or harnesses.','screensMoved'),
s('good','Conecta el arnés delantero a la pantalla conocida buena.','Connect the front harness to the known-good screen.','swapGood'),
s('suspect','Conecta el arnés trasero a la pantalla sospechosa.','Connect the rear harness to the suspect screen.','swapSuspect'),
s('result','Pon ON y compara. Si la rueda sigue a la pantalla, la pantalla está dañada; si permanece en el vehículo, revisa arnés/EM. Puedes repetir el otro ejemplo desde el selector de esta lección.','Turn ON and compare. If the wheel follows the screen, the screen is faulty; if it stays with the vehicle, investigate harness/EM. Repeat the other example using this lesson’s selector.','keyOn') ]},
{id:'bypass',title:{es:'Bypass del sistema',en:'Bypass the system'},scenario:'F3',steps:[
s('scope','Si no puedes resolver la falla, el bypass permite operar sin Fleet mientras llega un técnico. La ubicación solo la conocen técnicos autorizados y supervisores. Pon OFF.','If the fault cannot be resolved, bypass allows operation without Fleet until a technician arrives. Its location is known only to authorized technicians and supervisors. Turn OFF.','keyOff'),
s('black','Selecciona el par del relé 1 con cable negro y pulsa Desconectar. Separa el lado Fleet del lado del montacargas.','Select the relay 1 pair with the black wire and press Disconnect. Separate the Fleet side from the forklift side.','bypassBlack'),
s('stripe','Desconecta también el par negro/blanco. Conserva libres los dos conectores que vienen del arnés del montacargas.','Also disconnect the black/white pair. Keep the two forklift-harness connectors free.','bypassStripe'),
s('join','Acerca y conecta entre sí los dos conectores del montacargas. No vuelvas a unirlos a Fleet.','Bring together and connect the two forklift connectors. Do not reconnect them to Fleet.','bypassJoined'),
s('result','El vehículo puede operar sin interactuar con Fleet mientras llega el técnico. El bypass se registra aparte; no repara la comunicación ni significa que la pantalla deba arrancar normal.','The vehicle can operate without interacting with Fleet until the technician arrives. Bypass is logged separately; it does not repair communication or imply normal screen startup.') ]}
];
export function mountLearning({getLanguage,prepare,getState}){
 const $=id=>document.getElementById(id);let active=null,index=0,variant='screen',prepared=null;
 const api={get active(){return active;},get index(){return index;},get variant(){return variant;},flow:{mode:'learning'},observe(){},reset(){},start(id,value='screen'){active=lessons.find(l=>l.id===id);if(!active)throw new Error('Unknown lesson');index=0;variant=value;prepared=active.scenario;prepare(prepared,variant);render();},menu(){active=null;render();},tick(){if(active)$('lessonNext').disabled=false;},render};
 function enter(){const code=active.steps.slice(0,index+1).filter(s=>s.setup).at(-1)?.setup||active.scenario;if(code!==prepared){prepared=code;prepare(code,variant);}render();}
 function render(){const lang=getLanguage(),es=lang==='es';$('lessonMenu').hidden=!!active;$('learningGuide').hidden=!active;$('menuTitle').textContent=es?'¿Qué quieres aprender?':'What would you like to learn?';$('menuIntro').textContent=es?'Elige una lección. Cada una prepara sus piezas y mediciones.':'Choose a lesson. Each prepares its parts and measurements.';
 $('lessonMenuItems').replaceChildren(...lessons.map((l,i)=>{const b=document.createElement('button');b.textContent=`${i+1}. ${l.title[lang]}`;b.onclick=()=>api.start(l.id);return b;}));
 $('backToMenu').textContent=es?'Menú de lecciones':'Lesson menu';$('lessonRestart').textContent=es?'Repetir lección':'Repeat lesson';$('lessonPrevious').textContent=es?'Anterior':'Previous';$('lessonNext').textContent=index===active?.steps.length-1?(es?'Terminar':'Finish'):(es?'Siguiente':'Next');
 $('swapVariant').hidden=active?.id!=='swap';$('swapVariant').options[0].text=es?'Ejemplo: sigue a la pantalla':'Example: follows the screen';$('swapVariant').options[1].text=es?'Ejemplo: permanece en vehículo':'Example: stays with the vehicle';$('swapVariant').value=variant;
 $('meterControls').hidden=!active||!['voltage','continuity','swap'].includes(active.id);
 if(active){$('lessonCounter').textContent=`${index+1} / ${active.steps.length}`;$('lessonTitle').textContent=active.title[lang];$('lessonBody').textContent=active.steps[index].text[lang];$('lessonPrevious').disabled=index===0;api.tick();}
 }
 $('backToMenu').onclick=api.menu;$('lessonRestart').onclick=()=>api.start(active.id,variant);$('lessonPrevious').onclick=()=>{if(index>0){index--;enter();}};
 $('lessonNext').onclick=()=>{if(!active)return;if(index===active.steps.length-1){api.menu();return;}index++;enter();};
 $('swapVariant').onchange=()=>api.start('swap',$('swapVariant').value);render();return api;
}

// Exact documented pin references for the current instructional step.
export function pinTargets(lesson,step){
 const target=(kind,n,tone='can')=>({kind,n,tone});
 if((lesson==='voltage'&&['mode','read','zero','interpret'].includes(step))||(lesson==='swap'&&step==='voltage'))return [target('circular',7,'red'),target('circular',8,'black')];
 if(lesson==='continuity'||lesson==='swap'){
 if(['endLo','failed','lo'].includes(step))return [target('orange',9),target('circular',1)];
 if(['endHi','hi'].includes(step))return [target('orange',10),target('circular',2)];
 if(step==='upper')return [target('orange',9),target('up4',3)];
 if(step==='lower')return [target('circular',1),target('low4',3)];
 if(step==='isolate')return [target('orange',10),target('up4',4),target('circular',2),target('low4',4)];
 }
 if(lesson==='wires')return ({orange:[target('orange',9),target('orange',10)],upper:[target('up4',3),target('up4',4)],lower:[target('low4',3),target('low4',4)],circular:[target('circular',1),target('circular',2),target('circular',12,'warning')]})[step]||[];
 return [];
}
