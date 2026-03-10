import { useState, useEffect, useContext } from "react";
import Upload from "../components/Upload"

function Update(){
    // return <>
    //   <iframe src="/update" style={{ overflow: 'hidden', width: '100%', height: '500px' }} />
    //   </>
    return (
        <div className="update">
            <Upload></Upload>
        </div>
    );
}

export default Update;