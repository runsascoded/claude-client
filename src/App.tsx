import { FormEvent, HTMLProps, KeyboardEvent, useCallback, useEffect, useState, } from 'react'
import './App.css'
import Anthropic from "@anthropic-ai/sdk"
import useLocalStorageState from "use-local-storage-state"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { State } from "@rdub/base/state"
import Tooltip from "./Tooltip.tsx"
import GitHub from "@rdub/base/socials/GitHub"
import A from "@rdub/base/a"
import { useColorScheme } from "@rdub/base/color-scheme"
import { InputProps } from "@rdub/base/dom";
import { Brightness4SVGIcon } from "@react-md/material-icons";

const Repo = "runsascoded/claude-client"

type Message = Anthropic.Message

const TokenKey = "anthropic-token"
const PromptKey = "anthropic-prompt"
const SystemPromptKey = "anthropic-system-prompt"
const ModelKey = "anthropic-model"

const DefaultPrompt = "What is a Claude?"
const DefaultSystemPrompt = "Respond only with a haiku"
const ExampleResponse: Message = {
  "id": "id",
  "type": "message",
  "role": "assistant",
  "model": "claude-3-5-sonnet-20240620",
  "content": [
    {
      "type": "text",
      "text": "Artificial mind\nSilicon dreams, language's dance\nI am Claude, AI"
    }
  ],
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 19,
    "output_tokens": 18
  }
}
const DefaultModel = "claude-3-5-sonnet-20240620"
const MaxTokensKey = "anthropic-max-tokens"
const DefaultMaxTokens = 100
const TemperatureKey = "anthropic-temperature"
const DefaultTemperature = 1

const H = 'h3'

function Div({ children, ...props }: HTMLProps<HTMLDivElement>) {
  return <div className={"section"} {...props}>{children}</div>
}

type Input<T = string> = State<T, "val"> & State<T, "saved">

function useInput<T = string>({ k, init }: { k: string, init: T }): Input<T> {
  const [ val, setVal ] = useLocalStorageState(k, { defaultValue: init })
  const [ saved, setSaved ] = useState(val)
  return { val, setVal, saved, setSaved, }
}

function Prompt(
  {
    k, title,
    input: { val, setVal, setSaved, },
    handleSubmit,
    cols = 50, rows = 5,
    ...props
  }: {
    k: string
    title: string
    input: Input
    handleSubmit?: () => void
    init?: string
  } & HTMLProps<HTMLTextAreaElement>
) {
  const handleKeyPress = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSaved(val)
        if (handleSubmit) {
          handleSubmit()
        }
      }
    },
    [ val, setSaved, ]
  )
  return (
    <Div>
      <label>
        <H>{title}</H>
        <textarea
          className={"prompt"}
          rows={rows}
          cols={cols}
          {...props}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyPress}
        />
      </label>
    </Div>
  )
}

function Num({ label, type = "int", val, setVal, ...props }: State<number, "val"> & {
  label: string
  type?: "int" | "float"
} & Omit<InputProps, "type" | "value" | "onChange">) {
  return (
    <Div>
      <label>
        <span>{label}:</span>
        <input
          type="number"
          {...props}
          value={val}
          onChange={e => setVal(
            (type === "int" ? parseInt : parseFloat)(e.target.value)
          )}
        />
      </label>
    </Div>
  )
}

function Message({ loading = false, ...msg }: Message & { loading?: boolean }) {
  const { content } = msg
  return <div className={`message ${loading ? "loading" : ""}`}>
    <H>Response:</H>
    {
      content.map((block, idx) =>
        block.type === "text" ?
          <div key={idx} className={"lines"}>{block.text.split("\n").map(
            (line, lineno) => <p key={`line-${lineno}`} className={"line"}>{line}</p>
          )}</div> :
          <pre key={idx}>{JSON.stringify(block, null, 2)}</pre>
      )
    }
    <details className={"full-response"}>
      <summary><h4>Full response</h4></summary>
      <pre className={"data"}>{JSON.stringify(msg, null, 2)}</pre>
    </details>
  </div>
}

function Token({ token, setToken }: State<string, "token">) {
  return <Div>
    <Tooltip
      // open
      title={<div>
        <p>Only stored in browser <code>localStorage.</code></p>
        <a href={"https://console.anthropic.com/dashboard"} target={"_blank"} rel={"noreferrer"}>
          Get a token from the Anthropic dashboard.
        </a>
      </div>}
      className={"menu"}
    >
      <label htmlFor={"token"}>
        <span>Token:</span>
      </label>
    </Tooltip>
    <input
      id={"token"}
      type="password"
      value={token ?? ""}
      onChange={(e) => setToken(e.target.value)}
    />
  </Div>
}

function Submit({ disabled, ...props }: Omit<HTMLProps<HTMLButtonElement>, "type">) {
  const button = <button type="submit" disabled={disabled} {...props}>Submit</button>
  return <Div>{
    disabled ? <Tooltip title={"Prompt, system prompt, and token required to submit."}><span>{button}</span></Tooltip> : button
  }</Div>
}

function App() {
  const [ token, setToken ] = useLocalStorageState<string>(TokenKey, { defaultValue: "" })
  const [ anthropic, setAnthropic ] = useState<Anthropic | null>(null)
  const prompt = useInput({ k: PromptKey, init: DefaultPrompt, })
  const system = useInput({ k: SystemPromptKey, init: DefaultSystemPrompt })
  const tokens = useInput({ k: MaxTokensKey, init: DefaultMaxTokens })
  const model = useInput({ k: ModelKey, init: DefaultModel })
  const temperature = useInput({ k: TemperatureKey, init: DefaultTemperature })
  const [ nonce, setNonce ] = useState(0)
  useEffect(() => {
    if (!token) {
      setAnthropic(null)
      return
    }
    const anthropic = new Anthropic({ apiKey: token, dangerouslyAllowBrowser: true })
    setAnthropic(anthropic)
  }, [token])

  const response = useQuery({
    queryKey: [ 'query', anthropic?.apiKey, prompt.saved, system.saved, model.saved, tokens.saved, temperature.saved, nonce, ],
    queryFn: async () => {
      if (!anthropic || !prompt.saved || !system.saved) {
        return null
      }
      if (nonce === 0) {
        return ExampleResponse
      }
      const message = await anthropic.messages.create({
        messages: [{ content: prompt.saved, role: "user" }],
        model: model.saved,
        system: system.saved,
        max_tokens: tokens.saved,
        temperature: temperature.saved,
      })
      console.log("anthropic response", message, `nonce ${nonce}`)
      return message
    },
    placeholderData: keepPreviousData,
  })
  const { data, refetch, isFetching, isLoading, isError, error } = response
  // console.log("response", response.status, response)

  const handleSubmit = useCallback(
    (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      ([ prompt, system, tokens, model, temperature ] as Input<any>[]).forEach(({ saved, val, setSaved }) => {
        if (saved !== val) {
          setSaved(val)
        }
      })
      setNonce(prevNonce => prevNonce + 1)
      console.log("handleSubmit:", { prompt, system, tokens, model, temperature, nonce, })
    },
    [ refetch, prompt, system, tokens, model, temperature, nonce, setNonce, ]
  )

  const { curScheme, toggleScheme } = useColorScheme()

  return (
    <div>
      <h2>Client-only interface to <A href={"https://claude.ai/"}>Claude</A></h2>
      <form className={"form"} onSubmit={handleSubmit}>
        <Prompt handleSubmit={handleSubmit} title={"Prompt"} k={PromptKey} input={prompt} />
        <Prompt handleSubmit={handleSubmit} title={"System prompt"} k={SystemPromptKey} input={system} rows={2} />
        <Submit disabled={!token || !prompt.saved || !system.saved} />
        <Div>
          {
            isFetching || isLoading ? (data ? <Message {...data} loading={true} /> : "Loading...") :
            isError ? `Error: ${(error as Error).message}` :
            data ? <Message {...data} /> :
            null
          }
        </Div>
        <Token token={token} setToken={val => {
          setToken(val)
          setNonce(prevNonce => prevNonce + 1)
        }} />
        <Div>
          <label>
            <span>Model:</span>
            <input
              type="text"
              className={"model"}
              value={model.val}
              onChange={(e) => model.setVal(e.target.value)}
            />
          </label>
        </Div>
        <Num label={"Max Tokens"} className={"max-tokens"} val={tokens.val} setVal={tokens.setVal} />
        <Num label={"Temperature"} className={"temperature"} val={temperature.val} setVal={temperature.setVal} type={"float"} min={-1} max={1} step={0.1} />
      </form>
      <Div>
        <Tooltip title={`View ${Repo} on GitHub`}>
          <GitHub repo={Repo} className={"github icon"} />
        </Tooltip>
        <Tooltip title={`Switch to "${curScheme === "light" ? "dark" : "light"}" mode`}>
          <Brightness4SVGIcon className={"color-scheme-icon icon"} onClick={toggleScheme} />
        </Tooltip>
      </Div>
    </div>
  )
}

export default App
