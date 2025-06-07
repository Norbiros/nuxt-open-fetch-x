import type { OpenFetchClientName } from '#build/open-fetch'
import type { AsyncData, UseFetchOptions } from 'nuxt/app'
import type { $Fetch } from 'ofetch'
import type { Ref } from 'vue'
import type { FetchResponseData, FetchResponseError, FilterMethods, ParamsOption, RequestBodyOption } from './fetch'
import { useFetch, useNuxtApp } from 'nuxt/app'
import { digest } from 'ohash'
import { toValue } from 'vue'

type PickFrom<T, K extends Array<string>> = T extends Array<any> ? T : T extends Record<string, any> ? keyof T extends K[number] ? T : K[number] extends never ? T : Pick<T, K[number]> : T
type KeysOf<T> = Array<T extends T ? keyof T extends string ? keyof T : never : never>

type ComputedOptions<T> = {
  [K in keyof T]: T[K] extends Function ? T[K] : ComputedOptions<T[K]> | Ref<T[K]> | T[K]
}
type ComputedMethodOption<M, P> = 'get' extends keyof P ? ComputedOptions<{ method?: M }> : ComputedOptions<{ method: M }>

type UseOpenFetchOptions<
  Method,
  LowercasedMethod,
  Params,
  ResT,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
  Operation = 'get' extends LowercasedMethod ? ('get' extends keyof Params ? Params['get'] : never) : LowercasedMethod extends keyof Params ? Params[LowercasedMethod] : never,
>
= ComputedMethodOption<Method, Params>
  & ComputedOptions<ParamsOption<Operation>>
  & ComputedOptions<RequestBodyOption<Operation>>
  & Omit<UseFetchOptions<ResT, DataT, PickKeys, DefaultT>, 'query' | 'body' | 'method'>

export type UseOpenFetchClient<Paths, Lazy> = <
  ReqT extends Extract<keyof Paths, string>,
  Methods extends FilterMethods<Paths[ReqT]>,
  Method extends Extract<keyof Methods, string> | Uppercase<Extract<keyof Methods, string>>,
  LowercasedMethod extends Lowercase<Method> extends keyof Methods ? Lowercase<Method> : never,
  DefaultMethod extends 'get' extends LowercasedMethod ? 'get' : LowercasedMethod,
  ResT = Methods[DefaultMethod] extends Record<string | number, any> ? FetchResponseData<Methods[DefaultMethod]> : never,
  ErrorT = Methods[DefaultMethod] extends Record<string | number, any> ? FetchResponseError<Methods[DefaultMethod]> : never,
  DataT = ResT,
  PickKeys extends KeysOf<DataT> = KeysOf<DataT>,
  DefaultT = null,
>(
  url: ReqT | (() => ReqT),
  options?: Lazy extends true
    ? Omit<UseOpenFetchOptions<Method, LowercasedMethod, Methods, ResT, DataT, PickKeys, DefaultT>, 'lazy'>
    : UseOpenFetchOptions<Method, LowercasedMethod, Methods, ResT, DataT, PickKeys, DefaultT>
) => AsyncData<PickFrom<DataT, PickKeys> | DefaultT, ErrorT | null>

export function createUseOpenFetch<
  Paths,
  Lazy = false,
>(client: $Fetch | OpenFetchClientName, lazy?: Lazy): UseOpenFetchClient<Paths, Lazy>
export function createUseOpenFetch<
  Paths,
  Lazy = true,
>(client: $Fetch | OpenFetchClientName, lazy?: Lazy): UseOpenFetchClient<Paths, Lazy>
export function createUseOpenFetch<
  Paths,
  Lazy extends boolean,
>(client: $Fetch | OpenFetchClientName, lazy = false): UseOpenFetchClient<Paths, Lazy> {
  return (url: string | (() => string), options: any = {}) => {
    // https://nuxt.com/docs/guide/recipes/custom-usefetch#custom-usefetchuseasyncdata
    const nuxtApp = useNuxtApp()
    const fetch = (typeof client === 'string' ? nuxtApp[`$${client}`] : client) as typeof $fetch

    const key = options.key ?? createAutoKey(url, options)
    const opts = { $fetch: fetch, key, ...options }
    if (opts.header) {
      opts.headers = opts.header
      delete opts.header
    }
    return useFetch(url, lazy ? { ...opts, lazy } : { ...opts })
  }
}

function createAutoKey(url: string | (() => string), options: any) {
  const resolvedRequestOptions = {
    url: typeof url === 'string' ? url : url(),
    method: options.method,
    path: options.path,
    query: options.query,
    body: options.body,
  }

  // Convert to json string and use a custom replacer function to unref all refs.
  const resolvedRequestOptionsJson = JSON.stringify(resolvedRequestOptions, (_, value) => toValue(value))

  return digest(resolvedRequestOptionsJson)
}
