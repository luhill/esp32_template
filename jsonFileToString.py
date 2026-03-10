Import("env") # type: ignore
import os

def generateControls():#(source, target, env):
    try:
        controls_location = 'src/config/app.json'
        controls_path = os.path.join(env.get('PROJECT_DIR'), controls_location)
        with open(controls_path, 'r', encoding='utf-8') as file:
                content = file.read()
        #strControls = "\"" + str(content).strip() + "\""
        strControls = str(content).replace('\r',' ').replace('\n', '').replace('\t',' ')
        strControls =' '.join(strControls.split())
        #print(strControls)
        #print(f"The file '{controls_path}' strored into #Define CONTROLS")
        return strControls
    except FileNotFoundError:
        #print(f"Error: The file '{controls_path}' was not found.")
        return "file not found"
    except Exception as e:
        #print(f"An error occurred while reading the file: {e}")
        return "exception"    


#env.ProcessUnFlags("-DCONTROLS")
#env.Append(CPPDEFINES=("CONTROLS", strControls))
#env.Append(BUILD_FLAGS=["-DCONTROLS=" + str(generateControl())])
#quoted_value = f'"{generateControl()}"' 
#quoted_value = env.StringifyMacro(generateControls());
#quoted_value = '\"{\"test\":69}\"'
#print(quoted_value)
# env.Append(
#     #CPPDEFINES=[
#     BUILD_FLAGS=[
#         '-DCONTROLS=' + quoted_value
#     ]
# )

#c = env.StringifyMacro('{"test":1,"status":2,"best":[1,2,3],"ctrls":[{"t":1},{"x":2}]}')
#c = env.StringifyMacro(generateControls())
c = generateControls()
print(c)
env.Append(CPPDEFINES=[
    ("APP_JSON_STRING", env.StringifyMacro(c)),
    #("CONTROLS", c),
])
