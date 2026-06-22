import plugins.observability.nemo_relay as nemo_relay_plugin


class _FakeRuntime:
    def __init__(self, decision):
        self._decision = decision

    def inspector_enabled(self) -> bool:
        return True

    def inspect(self, target, kwargs):
        return self._decision(target, kwargs)

    def managed_tool_enabled(self) -> bool:
        return False


def test_llm_request_middleware_applies_mutation(monkeypatch):
    runtime = _FakeRuntime(
        lambda _target, _kwargs: {
            "kind": "mutate",
            "target": {
                "kind": "llm_request",
                "provider": "openai",
                "request": {"messages": [{"role": "user", "content": "redacted"}]},
            },
        }
    )
    monkeypatch.setattr(nemo_relay_plugin, "_get_runtime", lambda: runtime)

    result = nemo_relay_plugin.on_llm_request_middleware(
        request={"messages": [{"role": "user", "content": "alice@example.com"}]},
        provider="openai",
        session_id="demo-session",
    )

    assert result == {
        "request": {"messages": [{"role": "user", "content": "redacted"}]},
        "source": "observability/nemo_relay",
        "reason": "external inspector mutated llm request",
    }


def test_tool_request_middleware_applies_mutation(monkeypatch):
    runtime = _FakeRuntime(
        lambda _target, _kwargs: {
            "kind": "mutate",
            "target": {
                "kind": "tool_request",
                "tool_name": "search",
                "input": {"query": "books", "relay_inspected": True},
            },
        }
    )
    monkeypatch.setattr(nemo_relay_plugin, "_get_runtime", lambda: runtime)

    result = nemo_relay_plugin.on_tool_request_middleware(
        tool_name="search",
        args={"query": "books"},
        session_id="demo-session",
    )

    assert result == {
        "args": {"query": "books", "relay_inspected": True},
        "source": "observability/nemo_relay",
        "reason": "external inspector mutated tool args",
    }


def test_tool_execution_middleware_denies_without_calling_next(monkeypatch):
    runtime = _FakeRuntime(
        lambda _target, _kwargs: {
            "kind": "deny",
            "reason": "blocked dangerous tool input",
            "findings": [{"code": "dangerous_tool_input", "message": "blocked"}],
        }
    )
    monkeypatch.setattr(nemo_relay_plugin, "_get_runtime", lambda: runtime)
    called = {"next": False}

    def next_call(_args):
        called["next"] = True
        return {"ok": True}

    result = nemo_relay_plugin.on_tool_execution_middleware(
        tool_name="search",
        args={"query": "DROP TABLE users"},
        next_call=next_call,
        session_id="demo-session",
    )

    assert called["next"] is False
    assert result == {
        "error": "blocked by external inspector",
        "reason": "blocked dangerous tool input",
        "findings": [{"code": "dangerous_tool_input", "message": "blocked"}],
    }
