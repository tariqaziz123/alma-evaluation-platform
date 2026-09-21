
import { Redis } from "ioredis";
import type {
    Queue,
    SubmissionProcessingJob,
} from "./types.js";

const QUEUE_NAME = "submission-processing";

export class RedisQueue implements Queue {
    private readonly publisher: Redis;
    private readonly consumer: Redis;

    constructor(redisUrl = "redis://localhost:6379") {
        this.publisher = new Redis(redisUrl);
        this.consumer = new Redis(redisUrl);
    }

    async publish(job: SubmissionProcessingJob): Promise<void> {
        await this.publisher.lpush(
            QUEUE_NAME,
            JSON.stringify(job),
        );

        console.log(`[RedisQueue] Job published: ${job.jobId}`);
    }

    async consume(
        handler: (job: SubmissionProcessingJob) => Promise<void>,
    ): Promise<void> {
        console.log(
            `[RedisQueue] Waiting for jobs on "${QUEUE_NAME}"...`,
        );

        while (true) {
            const result = await this.consumer.brpop(
                QUEUE_NAME,
                0,
            );

            if (!result) {
                continue;
            }

            const [, rawJob] = result;

            const job = JSON.parse(
                rawJob,
            ) as SubmissionProcessingJob;

            console.log(`[RedisQueue] Job received: ${job.jobId}`);

            try {
                await handler(job);
            } catch (error) {
                console.error(
                    `[RedisQueue] Job processing failed: ${job.jobId}`,
                    error,
                );
            }
        }
    }

    async close(): Promise<void> {
        await Promise.all([
            this.publisher.quit(),
            this.consumer.quit(),
        ]);
    }
}