import { useEffect, useState } from 'react'
import './App.css'
import Anthropic from "@anthropic-ai/sdk"
import useLocalStorageState from "use-local-storage-state"
import { useQuery } from "react-query"


const TokenKey = "anthropic-token"

function App() {
  const [ token, setToken ] = useLocalStorageState<string | null>(TokenKey, { defaultValue: null })
  const [ anthropic, setAnthropic ] = useState<Anthropic | null>(null)
  const [ prompt, setPrompt ] = useState("")
  useEffect(() => {
    const anthropic = new Anthropic({ apiKey: token, dangerouslyAllowBrowser: true })
    setAnthropic(anthropic)
  }, [ token ])

  const response = useQuery({ queryKey: ['query', token ], queryFn: async () => {
      if (!anthropic) {
        return
      }
      const response = await anthropic.messages.create({
        messages: [{ content: prompt, role: "user" }],
        model: "claude-3-5-sonnet-20240620",
        system: "Respond only with short poems.",
        max_tokens: 100,
        temperature: 0,
      })
      console.log("anthropic response", response)
      return response
    }
  })
  return (
    <div>
      <h1>Claude client</h1>
      <form>
        <div>
          <label>
            Query:
            <textarea
              cols={50}
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
        </div>
        <div>
          <button onClick={() => response.refetch()}>Submit</button>
        </div>
        <div>
          <pre>{JSON.stringify(response.data, null, 2)}</pre>
        </div>
        <div>
          <label>
            Token:
            <input
              type={"password"}
              value={token ?? ""}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        </div>
      </form>
    </div>
  )
}

export default App
