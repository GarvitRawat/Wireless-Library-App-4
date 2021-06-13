import * as React from 'react';
import {Text,View,StyleSheet,TouchableOpacity,TextInput,Image,KeyboardAvoidingView, Alert, ToastAndroid} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as Permissions from 'expo-permissions';
import db from '../config';
import * as firebase from 'firebase';

export default class Transaction extends React.Component {
  getCameraPermission = async (id) => {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);
    this.setState({
      hasCameraPermission: status === 'granted',
      buttonState: id,
      scan: false,
    });
  };

  handleBarCodeScanned = async ({ data }) => {
    const { buttonState } = this.state;
    if (buttonState === 'BookId') {
      console.log(buttonState);
      this.setState({
        scan: true,
        scannedBookId: data,
        buttonState: 'normal',
      });
    } else if (buttonState === 'StudentId') {
      this.setState({
        scan: true,
        scannedStudentId: data,
        buttonState: 'normal',
      });
    }
  };

  checkBookEligibility = async ()=>
  {
    const bookRef = await db.collection('Books').where('BookId', '==',               this.state.scannedBookId).get()
    var transactionType = ""
    if (bookRef.docs.length === 0)
    {
      transactionType = false
      console.log(bookRef.docs.length)
    }
    else{
      bookRef.docs.map(doc=>{
        var book = doc.data()
        console.log(book)
        if (book.Avail)
        {
          transactionType = "issue"
        }else{
          transactionType = "return"
        }
      })
    }
    return transactionType
  }

  checkStudentEligibilityForBookIssue = async ()=>{
    const studentRef = await db.collection("Students").where('StudentID', '==', this.state.scannedStudentId).get()

    var isStudentEligible = ""

    if (studentRef.docs.length === 0)
    {
      isStudentEligible = false
      alert("Student Id does not Exist")
      this.setState({scannedBookId:'', scannedStudentId:''})
    }else {
      studentRef.docs.map(doc=>{
        var studentInfo = doc.data()
        console.log(studentInfo)
        if (studentInfo.OwnedCount < 2)
        {
          isStudentEligible = true
        }else{
          isStudentEligible = false
          alert("The student have already taken 2 books")
          this.setState({scannedStudentId:'', scannedBookId:''})
        }
      })
    }
    return isStudentEligible
  }

  checkStudentEligibilityForBookReturn = async ()=>
  {
    const transactionRef = await db.collection("Transaction").where('bookId', '==', this.state.scannedBookId).limit(1).get()
    var isStudentEligible = ""
    transactionRef.docs.map(doc=>{
      var lastBookTransaction = doc.data()
      console.log(lastBookTransaction) 
      if (lastBookTransaction.studentId === this.state.scannedStudentId)
      {
        isStudentEligible = true
      }else{
        isStudentEligible = false
        alert("The book was not issued to the student")
        this.setState({scannedBookId:'', scannedStudentId:''})
      }
    })
    return isStudentEligible
  }

  handleTransaction = async () => 
  {
    var transactionType = await this.checkBookEligibility()
    console.log("Transaction Type: " + transactionType)
    if (!transactionType)
    {
      alert("The book does not exist")
      this.setState({scannedBookId:'', scannedStudentId:''})
    }else if (transactionType === "issue")
    {
      var isStudentEligible = await this.checkStudentEligibilityForBookIssue()
      
      if (isStudentEligible)
      {
        this.initiateBookIssue()
        alert("Book was Issued")
      }
    }else{
      var isStudentEligible = await this.checkStudentEligibilityForBookReturn()
      if (isStudentEligible)
      {
        this.initiateBookReturn()
        alert("Book was Returned to the Library")
      }
    }
  };

  initiateBookIssue = async () => {
    db.collection('Transaction').add({
      studentId: this.state.scannedStudentId,
      bookId: this.state.scannedBookId,
      transactionType: 'issue',
      date: firebase.firestore.Timestamp.now().toDate(),
    });

    db.collection('Books').doc(this.state.scannedBookId).update({
      Avail: false,
    });

    db.collection('Students')
      .doc(this.state.scannedStudentId)
      .update({
        OwnedCount: firebase.firestore.FieldValue.increment(1),
      });

    this.setState({scannedBookId:'', scannedStudentId:''})
    
  };

  initiateBookReturn = async () => {
    db.collection('Transaction').add({
      studentId: this.state.scannedStudentId,
      bookId: this.state.scannedBookId,
      transactionType: 'return',
      date: firebase.firestore.Timestamp.now().toDate(),
    });

    db.collection('Books').doc(this.state.scannedBookId).update({
      Avail: true,
    });

    db.collection('Students')
      .doc(this.state.scannedStudentId)
      .update({
        OwnedCount: firebase.firestore.FieldValue.increment(-1),
      });

    this.setState({scannedBookId:'', scannedStudentId:''})
  };

  constructor() {
    super();
    this.state = {
      hasCameraPermission: null,
      scan: false,
      scannedData: '',
      buttonState: 'normal',
      scannedBookId: '',
      scannedStudentId: '',
      transactionMessage:"",
    };
  }

  render() {
    const hasCameraPermission = this.state.hasCameraPermission;
    const scanned = this.state.scan;
    const buttonState = this.state.buttonState;

    if (buttonState !== 'normal' && hasCameraPermission) {
      return (
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      );
    } else if (buttonState === 'normal') {
      return (
        <KeyboardAvoidingView style={styles.appHeader} behavior = "padding" enabled>
          <Image
            source={require('../assets/booklogo.jpg')}
            style={{ width: 100, height: 100, marginLeft: 100 }}
          />
          <View style={styles.container}>
            <View style={styles.view}>
              <TextInput style = {styles.input}
                placeholder="Book Id"
                value={this.state.scannedBookId}
                onChangeText = {text=>this.setState({scannedBookId:text})}
              />

              <TouchableOpacity style = {styles.scan}
                onPress={() => {
                  this.getCameraPermission('  BookId');
                }}>
                <Text> Scan</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.view}>
              <TextInput style = {styles.input}
                placeholder="Student Id"
                value={this.state.scannedStudentId}
                onChangeText = {text=>this.setState({scannedStudentId:text})}
              />
              <TouchableOpacity style = {styles.scan}
                onPress={() => {
                  this.getCameraPermission('StudentId');
                }}>
                <Text style = {{textAlign:"center"}}> Scan</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style = {styles.submit}
              onPress={async () => {
                this.handleTransaction();
              }}>
              <Text style = {{alignSelf:"center", fontSize:18}}>Submit</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      );
    }
  }
}

const styles = StyleSheet.create({
  appHeader: {
    flex: 1,
  },
  button: {
    backgroundColor: 'aqua',
    width: 120,
    alignSelf: 'center',
    height: 40,
    marginTop: 80,
    justifyContent: 'center',
  },
  text: {
    alignSelf: 'center',
    fontSize: 16,
  },
  container: {
    flex: 1,
  },
  view: {
    flexDirection: 'row',
  },
  scan:{
    flexDirection:'row',
    borderRadius:20,
    borderWidth:2,
    width:70,
    justifyContent:"center",
    marginTop:20,
    backgroundColor:"lightgrey"
  },
  input:{
    marginTop:20,
    borderRadius:20,
    borderWidth:2,
    width:120,
    marginRight:40,
    marginLeft:30,
    backgroundColor:"lightgrey",
    textAlign:"center",
    placeholderTextColor:"black"
  },
  submit:{
    borderRadius:20,
    borderWidth:3,
    width:100,
    backgroundColor:"aqua",
    marginTop:50,
    marginLeft:100,
    height:30
  }
});
