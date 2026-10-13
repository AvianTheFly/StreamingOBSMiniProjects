// Only broadcaster-authored reminders receive the quiet guide treatment.
// This is a visual classification, never permission to execute a command.
export const GUIDE_PREFIX='[COMMAND GUIDE] ';
export function isCommandGuide({text='',prefix='',tags={}},channel){
 const login=prefix.split('!')[0].toLowerCase();
 return !!channel&&login===channel.toLowerCase()&&text.startsWith(GUIDE_PREFIX)&&
  (!tags['source-room-id']||tags['source-room-id']===tags['room-id']);
}
