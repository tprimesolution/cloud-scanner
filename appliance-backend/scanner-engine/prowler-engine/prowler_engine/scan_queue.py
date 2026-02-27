"""Bounded async queue for scan job handling."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Awaitable, Callable


@dataclass
class _QueuedJob:
    coro_factory: Callable[[], Awaitable[Any]]
    future: asyncio.Future


class ScanJobQueue:
    def __init__(self, max_size: int, worker_count: int) -> None:
        self._queue: asyncio.Queue[_QueuedJob] = asyncio.Queue(maxsize=max_size)
        self._workers: list[asyncio.Task] = []
        self._worker_count = max(1, worker_count)
        self._started = False

    async def start(self) -> None:
        if self._started:
            return
        self._started = True
        for idx in range(self._worker_count):
            self._workers.append(asyncio.create_task(self._worker_loop(idx)))

    async def stop(self) -> None:
        if not self._started:
            return
        self._started = False
        for w in self._workers:
            w.cancel()
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()

    async def submit(self, coro_factory: Callable[[], Awaitable[Any]]) -> Any:
        loop = asyncio.get_running_loop()
        future: asyncio.Future = loop.create_future()
        await self._queue.put(_QueuedJob(coro_factory=coro_factory, future=future))
        return await future

    def size(self) -> int:
        return self._queue.qsize()

    async def _worker_loop(self, _idx: int) -> None:
        while True:
            job = await self._queue.get()
            try:
                result = await job.coro_factory()
                if not job.future.done():
                    job.future.set_result(result)
            except Exception as exc:  # noqa: BLE001
                if not job.future.done():
                    job.future.set_exception(exc)
            finally:
                self._queue.task_done()
