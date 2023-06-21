import RandExp from 'randexp'

const env = {
    var1: __ENV.TXMA_LOAD_PROFILE_TYPE_001,
    var2: __ENV.TXMA_LOAD_PROFILE_TYPE_001_001,
    var3: __ENV.TXMA_LOAD_PROFILE_TYPE_001_002,
    var4: __ENV.TXMA_LOAD_PROFILE_TYPE_001_003,
    var5: __ENV.TXMA_LOAD_PROFILE_TYPE_001_004
  }
  
let dataArray1: string[] = []

if (env.var1) {
    const delimiter = "___";
    dataArray1 = env.var1.split(delimiter).filter(Boolean)
  }

  let dataArray2: string[] = []

if (env.var2) {
    const delimiter = "___";
    dataArray2 = env.var2.split(delimiter)
  }

  let dataArray3: string[] = []

if (env.var3) {
    const delimiter = "___";
    dataArray3 = env.var3.split(delimiter)
  }

  let dataArray4: string[] = []

if (env.var4) {
    const delimiter = "___";
    dataArray4 = env.var4.split(delimiter)
  }

  let dataArray5: string[] = []

if (env.var5) {
    const delimiter = "___";
    dataArray5 = env.var5.split(delimiter)
  }