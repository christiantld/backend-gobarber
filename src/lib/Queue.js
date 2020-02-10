import Bee from 'bee-queue';
import CancellationMail from '../app/jobs/CancellationMail';
import redisConfig from '../config/redis';

//adicionar o jobs importados
const jobs = [CancellationMail];

class Queue {
  constructor() {
    // filas para cada servico
    //armazenado todos os jobs
    this.queues = {};
    this.init();
  }

  init() {
    // Armazena instancia Bee(conecta com redis) e handle(processa o job)
    jobs.forEach(({ key, handle }) => {
      this.queues[key] = {
        bee: new Bee(key, {
          redis: redisConfig,
        }),
        handle,
      };
    });
  }

  //adiciona um job a fila em background
  add(queue, job) {
    return this.queues[queue].bee.createJob(job).save();
  }

  //processar as filas
  processQueue() {
    jobs.forEach((job) => {
      const { bee, handle } = this.queues[job.key];

      bee.on('failed', this.handleFailure).process(handle);
    });
  }

  handleFailure(job, err) {
    console.log(`Queue ${job.queue.name}: FAILED`, err);
  }
}
export default new Queue();
