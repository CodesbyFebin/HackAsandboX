import { validateTask, Fault } from './core.mjs';
// Offline planner only. It never creates cluster resources or grants credentials.
export function planJob(task, image, runtimeClass = 'kata') {
  const spec=validateTask(task.spec);
  if(!/^[a-z0-9-]{1,63}$/.test(runtimeClass)||!/^sha256:[0-9a-f]{64}$/.test(image?.split('@')[1]??''))throw new Fault(400,'Digest-pinned image and valid installed RuntimeClass required');
  if(!/^[0-9a-f-]{36}$/.test(task.id))throw new Fault(400,'Task UUID required');
  return {apiVersion:'batch/v1',kind:'Job',metadata:{name:'mission-'+task.id,namespace:'hackasandbox-workers',labels:{'app.kubernetes.io/name':'sovereign-worker'}},spec:{backoffLimit:0,activeDeadlineSeconds:spec.budgetSeconds,ttlSecondsAfterFinished:3600,template:{metadata:{labels:{'app.kubernetes.io/name':'sovereign-worker'}},spec:{runtimeClassName:runtimeClass,automountServiceAccountToken:false,restartPolicy:'Never',securityContext:{runAsNonRoot:true,runAsUser:10001,runAsGroup:10001,seccompProfile:{type:'RuntimeDefault'}},containers:[{name:'worker',image,imagePullPolicy:'IfNotPresent',args:['--task',task.id,'--offline'],resources:{requests:{cpu:'250m',memory:'256Mi'},limits:{cpu:'1',memory:'1Gi','ephemeral-storage':'2Gi'}},securityContext:{allowPrivilegeEscalation:false,readOnlyRootFilesystem:true,capabilities:{drop:['ALL']}},volumeMounts:[{name:'workspace',mountPath:'/workspace'}]}],volumes:[{name:'workspace',emptyDir:{sizeLimit:'1Gi'}}]}}}};
}
